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
    // Prefer httpOnly cookie; fall back to Bearer header for API clients / dev tools
    const cookieToken = req.cookies?.pdm_token;
    const authHeader = req.headers.authorization;
    let token = cookieToken;
    if (!token) {
      if (!authHeader) return next(new Error('UNAUTHORIZED'));
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
        return next(new Error('UNAUTHORIZED'));
      }
      token = parts[1];
    }
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.warn(`[auth] JWT verification failed: ${err.name}`);
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
