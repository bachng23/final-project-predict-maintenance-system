const decisionService = require('../services/decision.service');

/**
 * GET /api/v1/decisions/pending
 * Get all pending decisions for HITL review
 */
const getPendingDecisions = async (req, res, next) => {
  try {
    const decisions = await decisionService.getPendingDecisions();

    res.json({
      success: true,
      count: decisions.length,
      data: decisions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/decisions/:id/action
 * Submit an action for a decision
 */
const submitDecisionAction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'Action is required',
      });
    }

    const result = await decisionService.submitDecisionAction(id, action, reason);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPendingDecisions,
  submitDecisionAction,
};
