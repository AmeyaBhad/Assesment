const userService = require('../services/user.service');
const { getActivityLogs } = require('../services/activityLog.service');
const { sendSuccess, sendPaginated } = require('../utils/response');

const getUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const result = await userService.getUsers({
      role,
      page: parseInt(page),
      limit: parseInt(limit),
    });
    return sendPaginated(res, result.users, result.pagination);
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    return sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    return sendSuccess(res, user, 'User updated successfully');
  } catch (error) {
    next(error);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const stats = await userService.getDashboardStats();
    return sendSuccess(res, stats, 'Dashboard data fetched');
  } catch (error) {
    next(error);
  }
};

const getActivityFeed = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await getActivityLogs({
      page: parseInt(page),
      limit: parseInt(limit),
    });
    return sendPaginated(res, result.logs, result.pagination);
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, getUserById, updateUser, getDashboard, getActivityFeed };
