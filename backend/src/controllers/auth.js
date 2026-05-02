const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const database = require('../services/database');
const usersRepository = require('../repositories/users');
const refreshTokensRepository = require('../repositories/refresh-tokens');
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

async function persistRefreshToken(userId, refreshToken, expiresAt, transactionClient = database) {
  return refreshTokensRepository.create({
    userId,
    tokenHash: getTokenHash(refreshToken),
    expiresAt
  }, transactionClient);
}

async function login(req, res) {
  const { username, password } = req.body || {};

  if (!username || !password) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Username and password are required');
  }

  const user = await usersRepository.findByUsername(username);

  if (!user || !user.active) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid username or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid username or password');
  }

  const loginAt = new Date();
  const tokenPair = createTokenPair(user);

  await database.transaction(async (transaction) => {
    await usersRepository.updateLastLoginAt(user.id, loginAt, transaction);
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

  const tokenRecord = await refreshTokensRepository.findByTokenHashWithUser(getTokenHash(refreshToken));

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

  await database.transaction(async (transaction) => {
    await refreshTokensRepository.revokeById(tokenRecord.id, new Date(), transaction);
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

  const tokenRecord = await refreshTokensRepository.findByTokenHash(getTokenHash(refreshToken));

  if (tokenRecord && !tokenRecord.revokedAt) {
    await refreshTokensRepository.revokeById(tokenRecord.id);
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
