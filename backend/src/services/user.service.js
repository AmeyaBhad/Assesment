const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const getUsers = async ({ role, page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (role) {
    conditions.push(`role = $${paramIndex++}`);
    params.push(role);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM users ${whereClause}`,
    params
  );

  const result = await db.query(
    `SELECT id, name, email, role, is_active, created_at, updated_at
     FROM users ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  const total = parseInt(countResult.rows[0].count);

  return {
    users: result.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getUserById = async (id) => {
  const result = await db.query(
    'SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

const updateUser = async (id, { name, email, role, is_active, password }) => {
  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (name) { updates.push(`name = $${paramIndex++}`); params.push(name); }
  if (email) { updates.push(`email = $${paramIndex++}`); params.push(email); }
  if (role) { updates.push(`role = $${paramIndex++}`); params.push(role); }
  if (is_active !== undefined) { updates.push(`is_active = $${paramIndex++}`); params.push(is_active); }
  if (password) {
    const hashed = await bcrypt.hash(password, 10);
    updates.push(`password = $${paramIndex++}`);
    params.push(hashed);
  }

  if (updates.length === 0) {
    const error = new Error('No valid fields to update');
    error.statusCode = 400;
    throw error;
  }

  updates.push(`updated_at = NOW()`);
  params.push(id);

  const result = await db.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, email, role, is_active, updated_at`,
    params
  );

  if (result.rows.length === 0) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

const getDashboardStats = async () => {
  const stats = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM leads) as total_leads,
      (SELECT COUNT(*) FROM leads WHERE status = 'new') as new_leads,
      (SELECT COUNT(*) FROM leads WHERE status = 'won') as won_leads,
      (SELECT COUNT(*) FROM leads WHERE status = 'lost') as lost_leads,
      (SELECT COUNT(*) FROM leads WHERE status IN ('contacted', 'qualified', 'proposal', 'negotiation')) as active_leads,
      (SELECT COUNT(*) FROM users WHERE role = 'agent') as total_agents,
      (SELECT COUNT(*) FROM users WHERE role = 'manager') as total_managers,
      (SELECT COUNT(*) FROM leads WHERE created_at >= NOW() - INTERVAL '7 days') as leads_this_week
  `);

  const leadsByStatus = await db.query(`
    SELECT status, COUNT(*) as count
    FROM leads
    GROUP BY status
    ORDER BY count DESC
  `);

  const leadsBySource = await db.query(`
    SELECT source, COUNT(*) as count
    FROM leads
    WHERE source IS NOT NULL
    GROUP BY source
    ORDER BY count DESC
    LIMIT 5
  `);

  const agentPerformance = await db.query(`
    SELECT 
      u.name,
      COUNT(l.id) as total_leads,
      COUNT(CASE WHEN l.status = 'won' THEN 1 END) as won_leads,
      COUNT(CASE WHEN l.status = 'lost' THEN 1 END) as lost_leads
    FROM users u
    LEFT JOIN leads l ON l.assigned_to = u.id
    WHERE u.role = 'agent'
    GROUP BY u.id, u.name
    ORDER BY total_leads DESC
    LIMIT 5
  `);

  return {
    summary: stats.rows[0],
    leadsByStatus: leadsByStatus.rows,
    leadsBySource: leadsBySource.rows,
    agentPerformance: agentPerformance.rows,
  };
};

module.exports = { getUsers, getUserById, updateUser, getDashboardStats };
