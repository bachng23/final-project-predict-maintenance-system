const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Middleware to require authentication via JWT
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new Error('UNAUTHORIZED'));
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (_) {
      return next(new Error('UNAUTHORIZED'));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id || decoded.sub },
    });

    if (!user || !user.active) {
      return next(new Error('UNAUTHORIZED'));
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to require specific roles
 * @param {string[]} roles
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new Error('FORBIDDEN'));
    }
    next();
  };
};

module.exports = {
  requireAuth,
  requireRole,
};
