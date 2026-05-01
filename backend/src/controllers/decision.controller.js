const decisionService = require('../services/decision.service');

class DecisionController {
  async getPendingDecisions(req, res, next) {
    try {
      const filters = req.query;
      const result = await decisionService.getPendingDecisions(filters);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getDecisionById(req, res, next) {
    try {
      const { decision_id } = req.params;
      const result = await decisionService.getDecisionById(decision_id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async submitAction(req, res, next) {
    try {
      const { decision_id } = req.params;
      const actionData = req.body;
      const actorUserId = req.user.id;
      const result = await decisionService.submitAction(decision_id, actionData, actorUserId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getDecisionHistory(req, res, next) {
    try {
      const filters = req.query;
      const result = await decisionService.getDecisionHistory(filters);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DecisionController();
