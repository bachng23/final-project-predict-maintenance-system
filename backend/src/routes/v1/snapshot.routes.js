const express = require('express');
const router = express.Router();
const snapshotController = require('../../controllers/snapshot.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

router.use(authenticate);

router.get('/', snapshotController.getAllSnapshots);
router.get('/:snapshot_id', snapshotController.getSnapshotById);

module.exports = router;
