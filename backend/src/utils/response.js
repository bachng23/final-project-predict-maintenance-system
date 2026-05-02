/**
 * Standardized response format based on TEAM_SHARED_CONTRACT
 */

const { getRequestId } = require('./request-context');

const sendSuccess = (res, data, meta = null, statusCode = 200) => {
    const response = { data };
    if (meta) {
        response.meta = meta;
    }
    return res.status(statusCode).json(response);
};

const sendError = (res, errorCode, message, detail = null, statusCode = 400, requestId = null) => {
    const resolvedRequestId = requestId || getRequestId();
    const errorResponse = {
        error: {
            code: errorCode,
            message,
        },
    };

    if (detail !== null && detail !== undefined) {
        errorResponse.error.detail = detail;
    }

    if (resolvedRequestId) {
        errorResponse.error.request_id = resolvedRequestId;
    }

    return res.status(statusCode).json(errorResponse);
};

module.exports = {
    sendSuccess,
    sendError,
};
