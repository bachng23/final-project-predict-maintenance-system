const { getRequestId } = require('./request-context');
const { isAppError } = require('./errors');

function normalizeError(errorOrOptions) {
  if (isAppError(errorOrOptions)) {
    return {
      statusCode: errorOrOptions.statusCode,
      code: errorOrOptions.code,
      message: errorOrOptions.message,
      detail: errorOrOptions.detail
    };
  }

  if (errorOrOptions instanceof Error) {
    return {
      statusCode: errorOrOptions.statusCode || 500,
      code: errorOrOptions.code || (errorOrOptions.statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR'),
      message: errorOrOptions.message || 'An unexpected error occurred',
      detail: errorOrOptions.detail
    };
  }

  return {
    statusCode: errorOrOptions?.statusCode || 500,
    code: errorOrOptions?.code || 'INTERNAL_ERROR',
    message: errorOrOptions?.message || 'An unexpected error occurred',
    detail: errorOrOptions?.detail
  };
}

function sendSuccess(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    request_id: getRequestId(),
    data
  });
}

function sendError(res, errorOrOptions = {}) {
  const normalizedError = normalizeError(errorOrOptions);

  return res.status(normalizedError.statusCode).json({
    success: false,
    request_id: getRequestId(),
    error: {
      code: normalizedError.code,
      message: normalizedError.message,
      detail: normalizedError.detail
    }
  });
}

module.exports = {
  sendSuccess,
  sendError,
  normalizeError
};