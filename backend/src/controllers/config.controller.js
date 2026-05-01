const configService = require('../services/config.service');

class ConfigController {
  async getThresholds(req, res, next) {
    try {
      const result = await configService.getConfig('THRESHOLDS');
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateThresholds(req, res, next) {
    try {
      const result = await configService.updateConfig('THRESHOLDS', req.body, req.user.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getAgents(req, res, next) {
    try {
      const result = await configService.getConfig('AGENTS');
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateAgents(req, res, next) {
    try {
      const result = await configService.updateConfig('AGENTS', req.body, req.user.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getSyntheticContext(req, res, next) {
    try {
      const result = await configService.getConfig('SYNTHETIC_CONTEXT');
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateSyntheticContext(req, res, next) {
    try {
      const result = await configService.updateConfig('SYNTHETIC_CONTEXT', req.body, req.user.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ConfigController();
