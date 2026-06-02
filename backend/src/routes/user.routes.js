const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

router.use(authenticate);

// GET /api/users/dashboard
router.get('/dashboard', authorize('admin', 'manager'), userController.getDashboard);

// GET /api/users/activity
router.get('/activity', authorize('admin', 'manager'), userController.getActivityFeed);

// GET /api/users - List users (admin only)
router.get('/', authorize('admin', 'manager'), userController.getUsers);

// GET /api/users/:id
router.get('/:id', authorize('admin', 'manager'), userController.getUserById);

// PUT /api/users/:id - Update user (admin only)
router.put(
  '/:id',
  authorize('admin'),
  [
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['admin', 'manager', 'agent']),
    body('is_active').optional().isBoolean(),
    body('password').optional().isLength({ min: 6 }),
  ],
  handleValidation,
  userController.updateUser
);

module.exports = router;
