const express = require('express');
const router = express.Router();
const decisionController = require('../../controllers/decision.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

router.use(authenticate);

router.get('/pending', decisionController.getPendingDecisions);
router.get('/history', decisionController.getDecisionHistory);
router.get('/:decision_id', decisionController.getDecisionById);
router.post('/:decision_id/action', authorize(['OPERATOR', 'ENGINEER', 'ADMIN']), decisionController.submitAction);

module.exports = router;
