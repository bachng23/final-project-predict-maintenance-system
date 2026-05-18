const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const prisma = require('../config/prisma');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

/**
 * Login user
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const login = async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }
    const { username, password } = parsed.data;

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
    });

    // Check if user exists
    if (!user) {
      console.warn('[auth] login_failed reason=user_not_found username=%s ip=%s', username, req.ip);
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    // Check if user is active
    if (!user.active) {
      console.warn('[auth] login_failed reason=inactive_account username=%s ip=%s', username, req.ip);
      return res.status(401).json({
        success: false,
        message: 'User account is inactive',
      });
    }

    // Compare password hash
    const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordMatch) {
      console.warn('[auth] login_failed reason=wrong_password username=%s ip=%s', username, req.ip);
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    // Sign JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Return success response
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
      },
    });
  } catch (error) {
    console.error('[auth] login_error ip=%s err=%s', req.ip, error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  login,
};
