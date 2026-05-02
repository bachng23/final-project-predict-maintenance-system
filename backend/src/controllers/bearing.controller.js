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

module.exports = {
  getBearings,
};
