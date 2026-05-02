const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');

function getBearerToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function authenticate(req, res, next) {
  try {
    if (!process.env.JWT_ACCESS_SECRET) {
      throw new AppError(500, 'CONFIG_ERROR', 'JWT access secret is not configured');
    }

    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Access token is required');
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    req.user = decoded;

    return next();
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError(401, 'UNAUTHORIZED', 'Invalid or expired access token'));
  }
}

function authorize(...allowedRoles) {
  return function authorizeRole(req, res, next) {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required');
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource');
      }

      return next();
    } catch (error) {
      return next(error instanceof AppError ? error : new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource'));
    }
  };
}

module.exports = {
  authenticate,
  authorize,
  getBearerToken
};
