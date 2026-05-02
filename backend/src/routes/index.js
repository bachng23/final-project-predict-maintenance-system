const express = require('express');
const router = express.Router();
const { AppError } = require('../utils/errors');
const { sendError, sendSuccess } = require('../utils/response');

const v1Routes = require('./v1');
router.use('/v1', v1Routes);

router.get('/health', (req, res) => {
  sendSuccess(res, { status: 'OK', message: 'Backend is running' });
});

router.use((req, res) => {
  sendError(res, new AppError(404, 'NOT_FOUND', `Route ${req.originalUrl} not found!`));
});

module.exports = router;
