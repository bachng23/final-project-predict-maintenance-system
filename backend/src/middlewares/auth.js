/**
 * JWT Authentication Middleware
 * Validates access tokens and extracts user information
 */

const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');
const { ErrorCodes, AppError } = require('../utils/errors');

const verifyAccessToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendError(
                res,
                ErrorCodes.UNAUTHORIZED,
                'Missing or invalid authorization header',
                'Expected: Authorization: Bearer <token>',
                401,
                req.requestId
            );
        }

        const token = authHeader.substring(7);

        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

        req.user = {
            id: decoded.id,
            username: decoded.username,
            role: decoded.role,
            iat: decoded.iat,
            exp: decoded.exp,
        };

        next();
    } catch (error) {
        let errorCode = ErrorCodes.INVALID_TOKEN;
        let statusCode = 401;
        let message = 'Invalid token';

        if (error.name === 'TokenExpiredError') {
            errorCode = ErrorCodes.TOKEN_EXPIRED;
            message = 'Token has expired';
        } else if (error.name === 'JsonWebTokenError') {
            message = 'Malformed token';
        }

        return sendError(
            res,
            errorCode,
            message,
            error.message,
            statusCode,
            req.requestId
        );
    }
};

/**
 * Role-based authorization middleware
 * Pass allowed roles as arguments
 */
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return sendError(
                res,
                ErrorCodes.UNAUTHORIZED,
                'User not authenticated',
                null,
                401,
                req.requestId
            );
        }

        if (!allowedRoles.includes(req.user.role)) {
            return sendError(
                res,
                ErrorCodes.FORBIDDEN,
                `Role '${req.user.role}' does not have permission for this resource`,
                `Allowed roles: ${allowedRoles.join(', ')}`,
                403,
                req.requestId
            );
        }

        next();
    };
};

module.exports = {
    verifyAccessToken,
    authorize,
};
