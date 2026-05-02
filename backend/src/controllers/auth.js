const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { sendSuccess, sendError } = require('../utils/response');
const { ErrorCodes } = require('../utils/errors');
const {
    findUserByUsername,
    findUserById,
    updateUserLastLogin,
} = require('../utils/user-store');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

const getJwtSecret = (name) => {
    const secret = process.env[name];

    if (!secret) {
        throw new Error(`${name} is not configured`);
    }

    return secret;
};

const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        getJwtSecret('JWT_ACCESS_SECRET'),
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role, type: 'refresh' },
        getJwtSecret('JWT_REFRESH_SECRET'),
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
};

const buildUserResponse = (user) => ({
    id: user.id,
    username: user.username,
    full_name: user.fullName,
    email: user.email,
    role: user.role,
    last_login_at: user.lastLoginAt || null,
});

/**
 * POST /api/v1/auth/login
 * Authenticate user with username and password
 */
const login = async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const normalizedUsername = typeof username === 'string' ? username.trim() : '';

        if (!normalizedUsername || typeof password !== 'string' || !password) {
            return sendError(
                res,
                ErrorCodes.INVALID_CREDENTIALS,
                'Username and password are required',
                null,
                400,
                req.requestId
            );
        }

        const user = await findUserByUsername(normalizedUsername);

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

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);

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

        const { accessToken, refreshToken } = generateTokens(user);
        const updatedUser = await updateUserLastLogin(user.id);
        const responseUser = buildUserResponse(updatedUser || user);

        return sendSuccess(
            res,
            {
                access_token: accessToken,
                refresh_token: refreshToken,
                token_type: 'Bearer',
                expires_in: 900,
                user: responseUser,
            },
            null,
            200
        );
    } catch (error) {
        console.error('Login error:', error);
        return sendError(
            res,
            ErrorCodes.INTERNAL_ERROR,
            'Login failed',
            process.env.NODE_ENV === 'development' ? error.message : undefined,
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
        const { refresh_token: refreshToken } = req.body || {};

        if (typeof refreshToken !== 'string' || !refreshToken) {
            return sendError(
                res,
                ErrorCodes.INVALID_REFRESH_TOKEN,
                'Refresh token is required',
                null,
                400,
                req.requestId
            );
        }

        let decoded;

        try {
            decoded = jwt.verify(refreshToken, getJwtSecret('JWT_REFRESH_SECRET'));
        } catch (error) {
            return sendError(
                res,
                ErrorCodes.INVALID_REFRESH_TOKEN,
                'Refresh token is invalid or expired',
                process.env.NODE_ENV === 'development' ? error.message : undefined,
                401,
                req.requestId
            );
        }

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

        const user = await findUserById(decoded.id);

        if (!user || user.username !== decoded.username || !user.active) {
            return sendError(
                res,
                ErrorCodes.USER_NOT_FOUND,
                'User not found or inactive',
                null,
                401,
                req.requestId
            );
        }

        const { accessToken, refreshToken: nextRefreshToken } = generateTokens(user);

        return sendSuccess(
            res,
            {
                access_token: accessToken,
                refresh_token: nextRefreshToken,
                expires_in: 900,
            },
            null,
            200
        );
    } catch (error) {
        console.error('Refresh token error:', error);
        return sendError(
            res,
            ErrorCodes.INTERNAL_ERROR,
            'Token refresh failed',
            process.env.NODE_ENV === 'development' ? error.message : undefined,
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
        const { refresh_token: refreshToken } = req.body || {};

        if (typeof refreshToken !== 'string' || !refreshToken) {
            return sendError(
                res,
                ErrorCodes.INVALID_REFRESH_TOKEN,
                'Refresh token is required',
                null,
                400,
                req.requestId
            );
        }

        try {
            jwt.verify(refreshToken, getJwtSecret('JWT_REFRESH_SECRET'));
        } catch (error) {
            return sendError(
                res,
                ErrorCodes.INVALID_REFRESH_TOKEN,
                'Refresh token is invalid or expired',
                process.env.NODE_ENV === 'development' ? error.message : undefined,
                401,
                req.requestId
            );
        }

        return sendSuccess(
            res,
            {
                message: 'Logged out successfully. Please discard your tokens.',
            },
            null,
            200
        );
    } catch (error) {
        console.error('Logout error:', error);
        return sendError(
            res,
            ErrorCodes.INTERNAL_ERROR,
            'Logout failed',
            process.env.NODE_ENV === 'development' ? error.message : undefined,
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
