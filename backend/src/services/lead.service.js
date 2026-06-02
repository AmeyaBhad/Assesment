const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { assignAgentToLead, decrementAgentLeadCount } = require('./assignment.service');
const { logActivity, ACTIONS } = require('./activityLog.service');
const { sendLeadAssignmentEmail } = require('../utils/email');
const logger = require('../utils/logger');

const createLead = async ({ name, email, phone, source, status = 'new', notes, createdBy }) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Auto-assign to least-loaded agent
    const agent = await assignAgentToLead(client);
    const id = uuidv4();

    const result = await client.query(
      `INSERT INTO leads (id, name, email, phone, source, status, assigned_to, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, name, email, phone, source, status, agent ? agent.id : null, createdBy, notes]
    );

    const lead = result.rows[0];

    await client.query('COMMIT');

    // Log activity (after commit)
    await logActivity({
      leadId: lead.id,
      userId: createdBy,
      action: ACTIONS.LEAD_CREATED,
      details: { name, source, status },
    });

    if (agent) {
      await logActivity({
        leadId: lead.id,
        userId: createdBy,
        action: ACTIONS.LEAD_ASSIGNED,
        details: { agentId: agent.id, agentName: agent.name },
      });

      // Send notification email (non-blocking)
      sendLeadAssignmentEmail({
        agentEmail: agent.email,
        agentName: agent.name,
        leadName: name,
        leadId: lead.id,
      }).catch((e) => logger.warn('Assignment email failed:', e.message));
    }

    return { ...lead, assignedAgent: agent };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const getLeads = async ({ page = 1, limit = 10, search, status, source, sortBy = 'created_at', sortOrder = 'DESC', userId, userRole }) => {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  // Role-based filtering
  if (userRole === 'agent') {
    conditions.push(`l.assigned_to = $${paramIndex++}`);
    params.push(userId);
  }

  if (search) {
    conditions.push(
      `(l.name ILIKE $${paramIndex} OR l.email ILIKE $${paramIndex} OR l.phone ILIKE $${paramIndex})`
    );
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (status) {
    conditions.push(`l.status = $${paramIndex++}`);
    params.push(status);
  }

  if (source) {
    conditions.push(`l.source = $${paramIndex++}`);
    params.push(source);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate sort columns
  const allowedSortColumns = ['name', 'email', 'status', 'source', 'created_at', 'updated_at'];
  const safeSortBy = allowedSortColumns.includes(sortBy) ? `l.${sortBy}` : 'l.created_at';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM leads l ${whereClause}`,
    params
  );

  const result = await db.query(
    `SELECT 
      l.*,
      u_assigned.name as assigned_to_name,
      u_assigned.email as assigned_to_email,
      u_created.name as created_by_name
    FROM leads l
    LEFT JOIN users u_assigned ON l.assigned_to = u_assigned.id
    LEFT JOIN users u_created ON l.created_by = u_created.id
    ${whereClause}
    ORDER BY ${safeSortBy} ${safeSortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  const total = parseInt(countResult.rows[0].count);

  return {
    leads: result.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getLeadById = async (id, userId, userRole) => {
  const result = await db.query(
    `SELECT 
      l.*,
      u_assigned.name as assigned_to_name,
      u_assigned.email as assigned_to_email,
      u_created.name as created_by_name,
      u_created.email as created_by_email
    FROM leads l
    LEFT JOIN users u_assigned ON l.assigned_to = u_assigned.id
    LEFT JOIN users u_created ON l.created_by = u_created.id
    WHERE l.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    const error = new Error('Lead not found');
    error.statusCode = 404;
    throw error;
  }

  const lead = result.rows[0];

  // Agents can only view their own leads
  if (userRole === 'agent' && lead.assigned_to !== userId) {
    const error = new Error('Access denied');
    error.statusCode = 403;
    throw error;
  }

  return lead;
};

const updateLead = async (id, updateData, userId, userRole) => {
  const lead = await getLeadById(id, userId, userRole);

  // Agents can only update status and notes
  if (userRole === 'agent') {
    const allowed = ['status', 'notes'];
    Object.keys(updateData).forEach((key) => {
      if (!allowed.includes(key)) delete updateData[key];
    });
  }

  const oldStatus = lead.status;
  const { name, email, phone, source, status, notes, assigned_to } = updateData;

  const result = await db.query(
    `UPDATE leads
     SET 
       name = COALESCE($1, name),
       email = COALESCE($2, email),
       phone = COALESCE($3, phone),
       source = COALESCE($4, source),
       status = COALESCE($5, status),
       notes = COALESCE($6, notes),
       assigned_to = COALESCE($7, assigned_to),
       updated_at = NOW()
     WHERE id = $8
     RETURNING *`,
    [name, email, phone, source, status, notes, assigned_to, id]
  );

  const updated = result.rows[0];

  await logActivity({
    leadId: id,
    userId,
    action: ACTIONS.LEAD_UPDATED,
    details: updateData,
  });

  if (status && status !== oldStatus) {
    await logActivity({
      leadId: id,
      userId,
      action: ACTIONS.STATUS_CHANGED,
      details: { from: oldStatus, to: status },
    });
  }

  // If reassigned
  if (assigned_to && assigned_to !== lead.assigned_to) {
    if (lead.assigned_to) {
      await decrementAgentLeadCount(lead.assigned_to);
    }
    await logActivity({
      leadId: id,
      userId,
      action: ACTIONS.LEAD_ASSIGNED,
      details: { from: lead.assigned_to, to: assigned_to },
    });
  }

  return updated;
};

const deleteLead = async (id, userId, userRole) => {
  const lead = await getLeadById(id, userId, userRole);

  if (userRole === 'agent') {
    const error = new Error('Agents cannot delete leads');
    error.statusCode = 403;
    throw error;
  }

  await db.query('DELETE FROM leads WHERE id = $1', [id]);

  if (lead.assigned_to) {
    await decrementAgentLeadCount(lead.assigned_to);
  }

  await logActivity({
    leadId: null,
    userId,
    action: ACTIONS.LEAD_DELETED,
    details: { leadId: id, leadName: lead.name },
  });
};

module.exports = { createLead, getLeads, getLeadById, updateLead, deleteLead };
