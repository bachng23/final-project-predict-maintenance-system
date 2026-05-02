class AppError extends Error {
  constructor(statusCode, code, message, options = {}) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.detail = options.detail;
    this.expose = options.expose ?? statusCode < 500;

    Error.captureStackTrace(this, this.constructor);
  }
}

function isAppError(error) {
  return error instanceof AppError;
}

module.exports = {
  AppError,
  isAppError
};