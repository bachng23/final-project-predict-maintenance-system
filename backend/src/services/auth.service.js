const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('./prisma.service');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'super-refresh-secret-key';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

class AuthService {
  async login(username, password) {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.active) {
      throw new Error('UNAUTHORIZED');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('UNAUTHORIZED');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // In a real production app, you might want to store refresh tokens in DB or Redis
    // For now, we just return them.

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { passwordHash, ...userWithoutPassword } = user;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600, // 1 hour in seconds
      user: userWithoutPassword,
    };
  }

  generateAccessToken(user) {
    return jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  generateRefreshToken(user) {
    return jwt.sign(
      { id: user.id },
      REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
  }

  async refreshToken(token) {
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user || !user.active) {
        throw new Error('UNAUTHORIZED');
      }

      const accessToken = this.generateAccessToken(user);
      return {
        access_token: accessToken,
        expires_in: 3600,
      };
    } catch (err) {
      throw new Error('UNAUTHORIZED');
    }
  }
}

module.exports = new AuthService();
