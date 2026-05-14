const express = require('express');
const authRoute = require('./auth.route');
const bearingRoute = require('./bearing.route');
const demoRoute = require('./demo.route');
const decisionRoute = require('./decision.route');

const router = express.Router();

router.use('/auth', authRoute);
router.use('/bearings', bearingRoute);
router.use('/demo', demoRoute);
router.use('/decisions', decisionRoute);

router.get('/', (req, res) => {
  res.json({ message: 'Predictive Maintenance API V1' });
});

module.exports = router;
