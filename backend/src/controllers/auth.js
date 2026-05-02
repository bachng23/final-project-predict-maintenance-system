const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../services/prisma');
const { AppError } = require('../utils/errors');
const { sendSuccess } = require('../utils/response');

function getJwtConfig() {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  if (!accessSecret || !refreshSecret) {
    throw new AppError(500, 'CONFIG_ERROR', 'JWT secrets are not configured');
  }

  return {
    accessSecret,
    refreshSecret,
    accessExpiresIn,
    refreshExpiresIn
  };
}

function getTokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getTokenFromRequest(req) {
  const bodyToken = req.body?.refreshToken || req.body?.token;

  if (bodyToken) {
    return bodyToken;
  }

  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function createTokenPair(user) {
  const { accessSecret, refreshSecret, accessExpiresIn, refreshExpiresIn } = getJwtConfig();
  const tokenPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    email: user.email
  };

  const accessToken = jwt.sign(tokenPayload, accessSecret, { expiresIn: accessExpiresIn });
  const refreshToken = jwt.sign({ ...tokenPayload, token_type: 'refresh' }, refreshSecret, {
    expiresIn: refreshExpiresIn
  });
  const decodedRefreshToken = jwt.decode(refreshToken);

  return {
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: new Date(decodedRefreshToken.exp * 1000)
  };
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    active: user.active,
    lastLoginAt: user.lastLoginAt
  };
}

async function persistRefreshToken(userId, refreshToken, expiresAt, transactionClient = prisma) {
  return transactionClient.refreshToken.create({
    data: {
      userId,
      tokenHash: getTokenHash(refreshToken),
      expiresAt
    }
  });
}

async function login(req, res) {
  const { username, password } = req.body || {};

  if (!username || !password) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Username and password are required');
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      passwordHash: true,
      role: true,
      active: true,
      lastLoginAt: true
    }
  });

  if (!user || !user.active) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid username or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid username or password');
  }

  const loginAt = new Date();
  const tokenPair = createTokenPair(user);

  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: loginAt
      }
    });

    await persistRefreshToken(user.id, tokenPair.refreshToken, tokenPair.refreshTokenExpiresAt, transaction);
  });

  return sendSuccess(res, {
    user: publicUser({ ...user, lastLoginAt: loginAt }),
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    tokenType: 'Bearer'
  });
}

async function refresh(req, res) {
  const refreshToken = getTokenFromRequest(req);

  if (!refreshToken) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Refresh token is required');
  }

  const { refreshSecret, accessSecret, accessExpiresIn, refreshExpiresIn } = getJwtConfig();

  let decodedRefreshToken;

  try {
    decodedRefreshToken = jwt.verify(refreshToken, refreshSecret);
  } catch (error) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token');
  }

  if (decodedRefreshToken.token_type !== 'refresh') {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token');
  }

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash: getTokenHash(refreshToken) },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          active: true,
          lastLoginAt: true
        }
      }
    }
  });

  if (
    !tokenRecord ||
    tokenRecord.revokedAt ||
    tokenRecord.expiresAt <= new Date() ||
    !tokenRecord.user.active
  ) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token');
  }

  const tokenPayload = {
    sub: tokenRecord.user.id,
    username: tokenRecord.user.username,
    role: tokenRecord.user.role,
    email: tokenRecord.user.email
  };

  const nextAccessToken = jwt.sign(tokenPayload, accessSecret, { expiresIn: accessExpiresIn });
  const nextRefreshToken = jwt.sign({ ...tokenPayload, token_type: 'refresh' }, refreshSecret, {
    expiresIn: refreshExpiresIn
  });
  const decodedNextRefreshToken = jwt.decode(nextRefreshToken);

  await prisma.$transaction(async (transaction) => {
    await transaction.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        revokedAt: new Date()
      }
    });

    await persistRefreshToken(
      tokenRecord.user.id,
      nextRefreshToken,
      new Date(decodedNextRefreshToken.exp * 1000),
      transaction
    );
  });

  return sendSuccess(res, {
    user: publicUser(tokenRecord.user),
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    tokenType: 'Bearer'
  });
}

async function logout(req, res) {
  const refreshToken = getTokenFromRequest(req);

  if (!refreshToken) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Refresh token is required');
  }

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash: getTokenHash(refreshToken) }
  });

  if (tokenRecord && !tokenRecord.revokedAt) {
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        revokedAt: new Date()
      }
    });
  }

  return sendSuccess(res, {
    message: 'Logged out successfully'
  });
}

module.exports = {
  login,
  refresh,
  logout
};
