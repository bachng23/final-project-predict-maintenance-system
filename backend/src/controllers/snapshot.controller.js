const snapshotService = require('../services/snapshot.service');

class SnapshotController {
  async getAllSnapshots(req, res, next) {
    try {
      const filters = req.query;
      const result = await snapshotService.getAllSnapshots(filters);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getSnapshotById(req, res, next) {
    try {
      const { snapshot_id } = req.params;
      const result = await snapshotService.getSnapshotById(snapshot_id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SnapshotController();
