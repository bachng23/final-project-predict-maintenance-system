const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');

/**
 * GET /api/v1/users
 * Get all users, optionally filtered by role
 */
const getUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    const where = {};
    if (role) {
      where.role = role;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/users
 * Create a new user
 */
const createUser = async (req, res, next) => {
  try {
    const { username, password, fullName, email, role } = req.body;

    if (!username || !password) {
      const error = new Error('Username and password are required');
      error.name = 'ValidationError';
      return next(error);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        fullName,
        email,
        role: role || 'VIEWER',
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    res.status(201).json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/users/:id
 * Update user (role or active status)
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, active } = req.body;

    // Build update data object
    const data = {};
    if (role !== undefined) data.role = role;
    if (active !== undefined) data.active = active;

    if (Object.keys(data).length === 0) {
      const error = new Error('At least one field (role or active) must be provided');
      error.name = 'ValidationError';
      return next(error);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
};
