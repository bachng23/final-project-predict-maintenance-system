const express = require('express');
const router = express.Router();
const v1Routes = require('./v1');

router.use('/v1', v1Routes);

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend is running' });
});

module.exports = router;
