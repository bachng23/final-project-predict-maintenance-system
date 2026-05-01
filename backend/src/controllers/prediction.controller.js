const predictionService = require('../services/prediction.service');

class PredictionController {
  async getPredictionHistory(req, res, next) {
    try {
      const { bearing_id } = req.params;
      const filters = req.query;
      const result = await predictionService.getPredictionHistory(bearing_id, filters);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getLatestPrediction(req, res, next) {
    try {
      const { bearing_id } = req.params;
      const result = await predictionService.getLatestPrediction(bearing_id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PredictionController();
