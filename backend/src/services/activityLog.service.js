const db = require('../db');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const ACTIONS = {
  LEAD_CREATED: 'LEAD_CREATED',
  LEAD_UPDATED: 'LEAD_UPDATED',
  LEAD_DELETED: 'LEAD_DELETED',
  LEAD_ASSIGNED: 'LEAD_ASSIGNED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
};

const logActivity = async ({ leadId = null, userId = null, action, details = {} }) => {
  try {
    await db.query(
      `INSERT INTO activity_logs (id, lead_id, user_id, action, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [uuidv4(), leadId, userId, action, JSON.stringify(details)]
    );
  } catch (error) {
    // Activity logging should not break the main flow
    logger.error('Failed to log activity:', error.message);
  }
};

const getActivityLogs = async ({ leadId = null, page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;

  let whereClause = leadId ? 'WHERE al.lead_id = $1' : '';
  const params = leadId ? [leadId, limit, offset] : [limit, offset];

  const countResult = await db.query(
    `SELECT COUNT(*) FROM activity_logs al ${whereClause}`,
    leadId ? [leadId] : []
  );

  const result = await db.query(
    `SELECT 
      al.*,
      u.name as user_name,
      u.role as user_role,
      l.name as lead_name
    FROM activity_logs al
    LEFT JOIN users u ON al.user_id = u.id
    LEFT JOIN leads l ON al.lead_id = l.id
    ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT $${leadId ? 2 : 1} OFFSET $${leadId ? 3 : 2}`,
    params
  );

  const total = parseInt(countResult.rows[0].count);

  // Normalize details: PostgreSQL JSONB returns objects; SQLite TEXT returns strings
  const logs = result.rows.map((row) => ({
    ...row,
    details: row.details
      ? (typeof row.details === 'string' ? JSON.parse(row.details) : row.details)
      : {},
  }));

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

module.exports = { logActivity, getActivityLogs, ACTIONS };
