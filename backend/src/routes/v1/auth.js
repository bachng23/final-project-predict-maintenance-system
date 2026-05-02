const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const authController = require('../../controllers/auth');

const router = express.Router();

router.post('/login', asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));

module.exports = router;