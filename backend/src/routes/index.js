const express = require('express');
const router = express.Router();
const v1Routes = require('./v1');
const bearingRoute = require('./v1/bearing.route');
const bearingsRoute = require('./v1/bearings');
const decisionRoute = require('./v1/decision.route');

router.use('/v1', v1Routes);

// Alias /api/bearings and /api/decisions to v1 routes
// bearingsRoute first: handles /overview and /:bearingId
// bearingRoute second: handles / and /:id/predictions
router.use('/bearings', bearingsRoute);
router.use('/bearings', bearingRoute);
router.use('/decisions', decisionRoute);

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend is running' });
});

module.exports = router;
