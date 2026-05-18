const express = require('express');
const { rateLimit } = require('express-rate-limit');
const authController = require('../../controllers/auth.controller');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

router.post('/login', loginLimiter, authController.login);

module.exports = router;
