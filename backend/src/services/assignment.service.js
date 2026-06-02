const db = require('../db');
const logger = require('../utils/logger');

/**
 * Least-loaded agent assignment strategy.
 * Finds the active agent with the fewest assigned leads.
 * Falls back to round-robin if counts are equal.
 * Uses a transaction with advisory lock to prevent race conditions.
 */
const assignAgentToLead = async (client) => {
  // Note: PostgreSQL uses pg_advisory_xact_lock, SQLite uses transactions for safety
  try {
    await client.query('SELECT pg_advisory_xact_lock(12345678)');
  } catch (e) {
    // SQLite doesn't support pg_advisory_xact_lock, transaction is enough
  }

  // Find agent with least open leads (scalable strategy)
  const result = await client.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      COALESCE(t.lead_count, 0) as lead_count,
      t.last_assigned_at
    FROM users u
    LEFT JOIN agent_assignment_tracker t ON u.id = t.agent_id
    WHERE u.role = 'agent' AND u.is_active = true
    ORDER BY
      COALESCE(t.lead_count, 0) ASC,
      COALESCE(t.last_assigned_at, '1970-01-01') ASC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    logger.warn('No active agents available for assignment');
    return null;
  }

  const agent = result.rows[0];

  // Update or insert tracker (works with both PostgreSQL and SQLite)
  try {
    await client.query(`
      INSERT INTO agent_assignment_tracker (agent_id, lead_count, last_assigned_at)
      VALUES ($1, 1, NOW())
      ON CONFLICT (agent_id)
      DO UPDATE SET
        lead_count = agent_assignment_tracker.lead_count + 1,
        last_assigned_at = NOW()
    `, [agent.id]);
  } catch (e) {
    // Fallback for DBs without ON CONFLICT support: explicit update then insert
    const updateResult = await client.query(`
      UPDATE agent_assignment_tracker
      SET lead_count = lead_count + 1, last_assigned_at = NOW()
      WHERE agent_id = $1
    `, [agent.id]);

    if (!updateResult.rowCount || updateResult.rowCount === 0) {
      await client.query(`
        INSERT INTO agent_assignment_tracker (agent_id, lead_count, last_assigned_at)
        VALUES ($1, 1, NOW())
      `, [agent.id]);
    }
  }

  return agent;
};

/**
 * Recalculate agent lead counts (run periodically for consistency)
 */
const syncAgentLeadCounts = async () => {
  try {
    // Try PostgreSQL syntax first
    try {
      await db.query(`
        INSERT INTO agent_assignment_tracker (agent_id, lead_count, last_assigned_at)
        SELECT
          u.id,
          COUNT(l.id),
          MAX(l.created_at)
        FROM users u
        LEFT JOIN leads l ON l.assigned_to = u.id AND l.status NOT IN ('won', 'lost')
        WHERE u.role = 'agent'
        GROUP BY u.id
        ON CONFLICT (agent_id)
        DO UPDATE SET
          lead_count = EXCLUDED.lead_count,
          last_assigned_at = EXCLUDED.last_assigned_at
      `);
    } catch (e) {
      // SQLite: use separate update/insert
      const counts = await db.query(`
        SELECT
          u.id,
          COUNT(l.id) as lead_count,
          MAX(l.created_at) as last_assigned_at
        FROM users u
        LEFT JOIN leads l ON l.assigned_to = u.id AND l.status NOT IN ('won', 'lost')
        WHERE u.role = 'agent'
        GROUP BY u.id
      `);

      for (const row of counts.rows) {
        await db.query(`
          UPDATE agent_assignment_tracker
          SET lead_count = $1, last_assigned_at = $2
          WHERE agent_id = $3
        `, [row.lead_count, row.last_assigned_at, row.id]);

        // If no rows were updated, insert
        const inserted = await db.query(`
          INSERT INTO agent_assignment_tracker (agent_id, lead_count, last_assigned_at)
          SELECT $1, $2, $3
          WHERE NOT EXISTS (
            SELECT 1 FROM agent_assignment_tracker WHERE agent_id = $1
          )
        `, [row.id, row.lead_count, row.last_assigned_at]);
      }
    }
    logger.info('Agent lead counts synced');
  } catch (error) {
    logger.error('Failed to sync agent lead counts:', error.message);
  }
};

/**
 * Decrement agent count when lead is reassigned or closed
 */
const decrementAgentLeadCount = async (agentId, client = db) => {
  try {
    await client.query(`
      UPDATE agent_assignment_tracker
      SET lead_count = GREATEST(lead_count - 1, 0)
      WHERE agent_id = $1
    `, [agentId]);
  } catch (error) {
    logger.error('Failed to decrement agent lead count:', error.message);
  }
};

module.exports = {
  assignAgentToLead,
  syncAgentLeadCounts,
  decrementAgentLeadCount,
};
