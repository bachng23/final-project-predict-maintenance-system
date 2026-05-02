const bearingService = require('../services/bearing.service');

/**
 * GET /api/v1/bearings
 * Get list of all bearings with their latest status
 */
const getBearings = async (req, res, next) => {
  try {
    const bearings = await bearingService.getAllBearingsWithLatestStatus();
    
    res.json({
      success: true,
      count: bearings.length,
      data: bearings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/bearings/:id/predictions
 * Get prediction history for a specific bearing
 */
const getBearingPredictions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const predictions = await bearingService.getPredictionsByBearingId(id, limit);

    res.json({
      success: true,
      count: predictions.length,
      data: predictions,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBearings,
  getBearingPredictions,
};
