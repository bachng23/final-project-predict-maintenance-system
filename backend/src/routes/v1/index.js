const express = require('express');
const bearingRoute = require('./bearing.route');

const router = express.Router();

router.use('/bearings', bearingRoute);

router.get('/', (req, res) => {
  res.json({ message: 'Predictive Maintenance API V1' });
});

module.exports = router;
