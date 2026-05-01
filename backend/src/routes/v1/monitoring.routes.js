const express = require('express');
const router = express.Router();
const monitoringController = require('../../controllers/monitoring.controller');

router.get('/health', monitoringController.getHealth);
router.get('/metrics/summary', monitoringController.getMetricsSummary);

module.exports = router;
