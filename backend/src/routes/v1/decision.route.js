const express = require('express');
const decisionController = require('../../controllers/decision.controller');

const router = express.Router();

router.get('/pending', decisionController.getPendingDecisions);
router.post('/:id/action', decisionController.submitDecisionAction);

module.exports = router;
