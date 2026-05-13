const express = require('express');
const decisionController = require('../../controllers/decision.controller');
<<<<<<< HEAD
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
=======

const router = express.Router();

router.get('/pending', decisionController.getPendingDecisions);
router.post('/:id/action', decisionController.submitDecisionAction);
>>>>>>> 65602107790586e966cb3f5a5342d35b62b7b020

module.exports = router;
