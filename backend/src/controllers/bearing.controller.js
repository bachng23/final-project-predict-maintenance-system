const bearingService = require('../services/bearing.service');

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/;

function parseSafeDate(value) {
  if (!value) return undefined;
  if (!ISO_DATE_RE.test(value)) return null; // signal bad format
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

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
    const { limit, start_date, end_date } = req.query;

    const parsedLimit = parseInt(limit);
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 1000)
      : 100;

    const startDate = parseSafeDate(start_date);
    const endDate = parseSafeDate(end_date);
    if (startDate === null || endDate === null) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use ISO 8601 (e.g. 2024-01-01T00:00:00Z).' });
    }

    const predictions = await bearingService.getPredictionsByBearingId(id, {
      limit: safeLimit,
      startDate,
      endDate,
    });

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
