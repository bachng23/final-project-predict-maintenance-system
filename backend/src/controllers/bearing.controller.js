const bearingService = require('../services/bearing.service');

class BearingController {
  async getAllBearings(req, res, next) {
    try {
      const filters = req.query;
      const result = await bearingService.getAllBearings(filters);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getBearingById(req, res, next) {
    try {
      const { bearing_id } = req.params;
      const result = await bearingService.getBearingById(bearing_id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BearingController();
