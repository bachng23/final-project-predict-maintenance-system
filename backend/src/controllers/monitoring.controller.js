const monitoringService = require('../services/monitoring.service');

class MonitoringController {
  async getHealth(req, res, next) {
    try {
      const result = await monitoringService.getHealth();
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getMetricsSummary(req, res, next) {
    try {
      const result = await monitoringService.getMetricsSummary();
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MonitoringController();
