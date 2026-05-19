const bcrypt = require('bcrypt');
const { z } = require('zod');
const prisma = require('../config/prisma');

const VALID_ROLES = ['ADMIN', 'OPERATOR', 'ENGINEER', 'VIEWER'];

const createUserSchema = z.object({
  username: z.string().trim().min(3).max(32),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(VALID_ROLES).default('VIEWER'),
});

const updateUserSchema = z.object({
  role: z.enum(VALID_ROLES).optional(),
  active: z.boolean().optional(),
}).refine((data) => data.role !== undefined || data.active !== undefined, {
  message: 'At least one field (role or active) must be provided',
});

const getUsersQuerySchema = z.object({
  role: z.enum(VALID_ROLES).optional(),
});

/**
 * GET /api/v1/users
 * Get all users, optionally filtered by role
 */
const getUsers = async (req, res, next) => {
  try {
    const parsed = getUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
      });
    }

    const where = parsed.data.role ? { role: parsed.data.role } : {};

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
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message, detail: parsed.error.issues },
      });
    }

    const { username, password, fullName, email, role } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { username, passwordHash, fullName, email, role },
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
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message, detail: parsed.error.issues },
      });
    }

    const { id } = req.params;
    const user = await prisma.user.update({
      where: { id },
      data: parsed.data,
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
