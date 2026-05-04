const express = require('express');
const bearingRoute = require('./bearing.route');

const router = express.Router();
const bearingRoutes = require('./bearings');

router.use('/bearings', bearingRoutes);

router.use('/bearings', bearingRoute);

router.get('/', (req, res) => {
  res.json({ message: 'Predictive Maintenance API V1' });
});

module.exports = router;
