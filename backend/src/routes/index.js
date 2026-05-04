const express = require('express');
const router = express.Router();
const v1Routes = require('./v1');
const bearingRoute = require('./v1/bearing.route');

router.use('/v1', v1Routes);

// Alias /api/bearings to v1 bearing route
router.use('/bearings', bearingRoute);

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend is running' });
});

module.exports = router;
