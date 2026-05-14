const express = require('express');
const decisionController = require('../../controllers/decision.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @route GET /api/v1/decisions/pending
 */
router.get(
  '/pending',
  requireAuth,
  requireRole(['OPERATOR', 'ENGINEER', 'ADMIN']),
  decisionController.getPendingDecisions
);

/**
 * @route GET /api/v1/decisions/:id
 */
router.get(
  '/:id',
  requireAuth,
  requireRole(['OPERATOR', 'ENGINEER', 'ADMIN']),
  decisionController.getDecisionById
);

/**
 * @route POST /api/v1/decisions/:id/action
 */
router.post(
  '/:id/action',
  requireAuth,
  requireRole(['OPERATOR', 'ENGINEER', 'ADMIN']),
  decisionController.handleDecisionAction
);

module.exports = router;
