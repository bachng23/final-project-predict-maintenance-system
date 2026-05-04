const { getOverview, getBearingById } = require('../data/bearings');

function getOverviewController(req, res) {
  return res.json({
    success: true,
    data: getOverview()
  });
}

function getBearingDetailController(req, res) {
  const bearing = getBearingById(req.params.bearingId);

  if (!bearing) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Bearing ${req.params.bearingId} not found`
      }
    });
  }

  return res.json({
    success: true,
    data: bearing
  });
}

module.exports = {
  getOverview: getOverviewController,
  getDetail: getBearingDetailController
};
