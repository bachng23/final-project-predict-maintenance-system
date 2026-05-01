const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const bearingRoutes = require('./bearing.routes');
const predictionRoutes = require('./prediction.routes');
const snapshotRoutes = require('./snapshot.routes');
const decisionRoutes = require('./decision.routes');
const configRoutes = require('./config.routes');
const monitoringRoutes = require('./monitoring.routes');

router.use('/auth', authRoutes);
router.use('/bearings', bearingRoutes);
router.use('/predictions', predictionRoutes);
router.use('/snapshots', snapshotRoutes);
router.use('/decisions', decisionRoutes);
router.use('/config', configRoutes);
router.use('/monitoring', monitoringRoutes);

module.exports = router;
