/**
 * Error code catalog based on TEAM_SHARED_CONTRACT section 6.11
 */

const ErrorCodes = {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    BEARING_NOT_FOUND: 'BEARING_NOT_FOUND',
    PREDICTION_NOT_FOUND: 'PREDICTION_NOT_FOUND',
    SNAPSHOT_NOT_FOUND: 'SNAPSHOT_NOT_FOUND',
    DECISION_NOT_FOUND: 'DECISION_NOT_FOUND',
    DECISION_ALREADY_RESOLVED: 'DECISION_ALREADY_RESOLVED',
    DECISION_VERSION_CONFLICT: 'DECISION_VERSION_CONFLICT',
    INVALID_OPERATOR_ACTION: 'INVALID_OPERATOR_ACTION',
    INVALID_CONFIG_VALUE: 'INVALID_CONFIG_VALUE',
    RATE_LIMITED: 'RATE_LIMITED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    USER_INACTIVE: 'USER_INACTIVE',
};

const ErrorMessages = {
    [ErrorCodes.UNAUTHORIZED]: 'Authentication required',
    [ErrorCodes.FORBIDDEN]: 'Insufficient permissions',
    [ErrorCodes.INVALID_CREDENTIALS]: 'Invalid username or password',
    [ErrorCodes.INVALID_TOKEN]: 'Invalid or malformed token',
    [ErrorCodes.TOKEN_EXPIRED]: 'Token has expired',
    [ErrorCodes.INVALID_REFRESH_TOKEN]: 'Refresh token is invalid or expired',
    [ErrorCodes.USER_NOT_FOUND]: 'User not found',
    [ErrorCodes.USER_INACTIVE]: 'User account is inactive',
    [ErrorCodes.INTERNAL_ERROR]: 'Internal server error',
};

class AppError extends Error {
    constructor(code, message = null, statusCode = 400, detail = null) {
        super(message || ErrorMessages[code] || 'Unknown error');
        this.code = code;
        this.statusCode = statusCode;
        this.detail = detail;
    }
}

module.exports = {
    ErrorCodes,
    ErrorMessages,
    AppError,
};
