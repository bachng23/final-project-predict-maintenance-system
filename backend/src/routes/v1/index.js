const express = require('express');
const router = express.Router();
const authRoutes = require('./auth');
const { sendSuccess } = require('../../utils/response');

router.use('/auth', authRoutes);

router.get('/', (req, res) => {
  sendSuccess(res, { message: 'Predictive Maintenance API V1' });
});

module.exports = router;
