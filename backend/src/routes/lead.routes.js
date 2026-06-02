const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const leadController = require('../controllers/lead.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const VALID_SOURCES = ['website', 'referral', 'social', 'email', 'cold_call', 'event', 'other'];

// All routes require authentication
router.use(authenticate);

// POST /api/leads - Create lead (manager, admin only)
router.post(
  '/',
  authorize('admin', 'manager'),
  [
    body('name').trim().notEmpty().withMessage('Lead name is required').isLength({ max: 100 }),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phone').optional().isLength({ min: 5, max: 30 }).withMessage('Phone number must be between 5 and 30 characters'),
    body('source').optional().isIn(VALID_SOURCES).withMessage(`Source must be one of: ${VALID_SOURCES.join(', ')}`),
    body('status').optional().isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
    body('notes').optional().isLength({ max: 2000 }).withMessage('Notes cannot exceed 2000 characters'),
  ],
  handleValidation,
  leadController.createLead
);

// GET /api/leads - List leads with pagination, search, filter, sort
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(VALID_STATUSES).withMessage('Invalid status filter'),
    query('sortOrder').optional().isIn(['ASC', 'DESC', 'asc', 'desc']).withMessage('Sort order must be ASC or DESC'),
  ],
  handleValidation,
  leadController.getLeads
);

// GET /api/leads/:id - Get lead by ID
router.get('/:id', leadController.getLeadById);

// GET /api/leads/:id/activity - Get lead activity logs
router.get('/:id/activity', leadController.getLeadActivity);

// PUT /api/leads/:id - Update lead
router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 100 }),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phone').optional().isLength({ min: 5, max: 30 }).withMessage('Phone number must be between 5 and 30 characters'),
    body('source').optional().isIn(VALID_SOURCES).withMessage('Invalid source'),
    body('status').optional().isIn(VALID_STATUSES).withMessage('Invalid status'),
    body('notes').optional().isLength({ max: 2000 }).withMessage('Notes cannot exceed 2000 characters'),
  ],
  handleValidation,
  leadController.updateLead
);

// DELETE /api/leads/:id - Delete lead (admin, manager only)
router.delete('/:id', authorize('admin', 'manager'), leadController.deleteLead);

module.exports = router;
