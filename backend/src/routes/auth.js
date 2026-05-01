/**
 * Authentication Routes
 * POST /api/v1/auth/login
 * POST /api/v1/auth/refresh
 * POST /api/v1/auth/logout
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { login, refresh, logout } = require('../controllers/auth');
const { sendError } = require('../utils/response');
const { ErrorCodes } = require('../utils/errors');

/**
 * Validation middleware
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return sendError(
            res,
            ErrorCodes.INVALID_CREDENTIALS,
            'Validation failed',
            errors.array(),
            400,
            req.requestId
        );
    }
    next();
};

/**
 * POST /api/v1/auth/login
 */
router.post(
    '/login',
    [
        body('username').notEmpty().trim().withMessage('Username is required'),
        body('password').notEmpty().withMessage('Password is required'),
    ],
    handleValidationErrors,
    login
);

/**
 * POST /api/v1/auth/refresh
 */
router.post(
    '/refresh',
    [
        body('refresh_token').notEmpty().trim().withMessage('Refresh token is required'),
    ],
    handleValidationErrors,
    refresh
);

/**
 * POST /api/v1/auth/logout
 */
router.post(
    '/logout',
    [
        body('refresh_token').notEmpty().trim().withMessage('Refresh token is required'),
    ],
    handleValidationErrors,
    logout
);

module.exports = router;
