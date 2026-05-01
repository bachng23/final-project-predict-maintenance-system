/**
 * Standardized response format based on TEAM_SHARED_CONTRACT
 */

const sendSuccess = (res, data, meta = null, statusCode = 200) => {
    const response = { data };
    if (meta) {
        response.meta = meta;
    }
    return res.status(statusCode).json(response);
};

const sendError = (res, errorCode, message, detail = null, statusCode = 400, requestId = null) => {
    const errorResponse = {
        error: {
            code: errorCode,
            message,
        },
    };

    if (detail) {
        errorResponse.error.detail = detail;
    }

    if (requestId) {
        errorResponse.error.request_id = requestId;
    }

    return res.status(statusCode).json(errorResponse);
};

module.exports = {
    sendSuccess,
    sendError,
};
