const leadService = require('../services/lead.service');
const { getActivityLogs } = require('../services/activityLog.service');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

const createLead = async (req, res, next) => {
  try {
    const lead = await leadService.createLead({
      ...req.body,
      createdBy: req.user.id,
    });
    return sendSuccess(res, lead, 'Lead created and assigned successfully', 201);
  } catch (error) {
    next(error);
  }
};

const getLeads = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, source, sortBy, sortOrder } = req.query;

    const result = await leadService.getLeads({
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      search,
      status,
      source,
      sortBy,
      sortOrder,
      userId: req.user.id,
      userRole: req.user.role,
    });

    return sendPaginated(res, result.leads, result.pagination);
  } catch (error) {
    next(error);
  }
};

const getLeadById = async (req, res, next) => {
  try {
    const lead = await leadService.getLeadById(req.params.id, req.user.id, req.user.role);
    return sendSuccess(res, lead);
  } catch (error) {
    next(error);
  }
};

const updateLead = async (req, res, next) => {
  try {
    const lead = await leadService.updateLead(req.params.id, req.body, req.user.id, req.user.role);
    return sendSuccess(res, lead, 'Lead updated successfully');
  } catch (error) {
    next(error);
  }
};

const deleteLead = async (req, res, next) => {
  try {
    await leadService.deleteLead(req.params.id, req.user.id, req.user.role);
    return sendSuccess(res, null, 'Lead deleted successfully');
  } catch (error) {
    next(error);
  }
};

const getLeadActivity = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await getActivityLogs({
      leadId: req.params.id,
      page: parseInt(page),
      limit: parseInt(limit),
    });
    return sendPaginated(res, result.logs, result.pagination);
  } catch (error) {
    next(error);
  }
};

module.exports = { createLead, getLeads, getLeadById, updateLead, deleteLead, getLeadActivity };
