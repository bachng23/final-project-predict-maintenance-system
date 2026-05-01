/**
 * Authentication Controller
 * Handles login, refresh token, and logout according to TEAM_SHARED_CONTRACT
 * 
 * Endpoints:
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/refresh
 * - POST /api/v1/auth/logout
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { sendSuccess, sendError } = require('../utils/response');
const { ErrorCodes, AppError } = require('../utils/errors');
const prisma = require('../utils/prisma');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Generate JWT tokens
 */
const generateTokens = (userId, username, role) => {
    const accessToken = jwt.sign(
        { id: userId, username, role },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
        { id: userId, username, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
};

/**
 * POST /api/v1/auth/login
 * Authenticate user with username and password
 */
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return sendError(
                res,
                ErrorCodes.INVALID_CREDENTIALS,
                'Username and password are required',
                null,
                400,
                req.requestId
            );
        }

        // Find user
        const user = await prisma.users.findUnique({
            where: { username },
        });

        if (!user) {
            return sendError(
                res,
                ErrorCodes.INVALID_CREDENTIALS,
                'Invalid username or password',
                null,
                401,
                req.requestId
            );
        }

        // Check if user is active
        if (!user.active) {
            return sendError(
                res,
                ErrorCodes.USER_INACTIVE,
                'User account is inactive',
                null,
                403,
                req.requestId
            );
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return sendError(
                res,
                ErrorCodes.INVALID_CREDENTIALS,
                'Invalid username or password',
                null,
                401,
                req.requestId
            );
        }

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id, user.username, user.role);

        // Update last login timestamp
        await prisma.users.update({
            where: { id: user.id },
            data: { last_login_at: new Date() },
        });

        // Return success response
        const responseData = {
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: 'Bearer',
            expires_in: 900, // 15 minutes in seconds
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
            },
        };

        return sendSuccess(res, responseData, null, 200);
    } catch (error) {
        console.error('Login error:', error);
        return sendError(
            res,
            ErrorCodes.INTERNAL_ERROR,
            'Login failed',
            error.message,
            500,
            req.requestId
        );
    }
};

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
const refresh = async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return sendError(
                res,
                ErrorCodes.INVALID_REFRESH_TOKEN,
                'Refresh token is required',
                null,
                400,
                req.requestId
            );
        }

        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
        } catch (error) {
            return sendError(
                res,
                ErrorCodes.INVALID_REFRESH_TOKEN,
                'Refresh token is invalid or expired',
                error.message,
                401,
                req.requestId
            );
        }

        // Verify token type
        if (decoded.type !== 'refresh') {
            return sendError(
                res,
                ErrorCodes.INVALID_REFRESH_TOKEN,
                'Token is not a refresh token',
                null,
                401,
                req.requestId
            );
        }

        // Find user
        const user = await prisma.users.findUnique({
            where: { id: decoded.id },
        });

        if (!user || !user.active) {
            return sendError(
                res,
                ErrorCodes.USER_NOT_FOUND,
                'User not found or inactive',
                null,
                401,
                req.requestId
            );
        }

        // Generate new tokens
        const { accessToken, refreshToken } = generateTokens(user.id, user.username, user.role);

        const responseData = {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: 900, // 15 minutes in seconds
        };

        return sendSuccess(res, responseData, null, 200);
    } catch (error) {
        console.error('Refresh token error:', error);
        return sendError(
            res,
            ErrorCodes.INTERNAL_ERROR,
            'Token refresh failed',
            error.message,
            500,
            req.requestId
        );
    }
};

/**
 * POST /api/v1/auth/logout
 * Invalidate refresh token (client should discard tokens)
 */
const logout = async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return sendError(
                res,
                ErrorCodes.INVALID_REFRESH_TOKEN,
                'Refresh token is required',
                null,
                400,
                req.requestId
            );
        }

        // In a real system with token blacklisting, you would add the refresh token to a blacklist table
        // For now, we just verify the token is valid and return success
        // The client will discard the tokens

        try {
            jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
        } catch (error) {
            return sendError(
                res,
                ErrorCodes.INVALID_REFRESH_TOKEN,
                'Refresh token is invalid or expired',
                error.message,
                401,
                req.requestId
            );
        }

        const responseData = {
            message: 'Logged out successfully. Please discard your tokens.',
        };

        return sendSuccess(res, responseData, null, 200);
    } catch (error) {
        console.error('Logout error:', error);
        return sendError(
            res,
            ErrorCodes.INTERNAL_ERROR,
            'Logout failed',
            error.message,
            500,
            req.requestId
        );
    }
};

module.exports = {
    login,
    refresh,
    logout,
};
