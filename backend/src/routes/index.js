/**
 * API Routes Router
 * Organized by API version and resource
 */

const express = require('express');
const authRoutes = require('./auth');
const { sendSuccess } = require('../utils/response');

const router = express.Router();

/**
 * v1 API Routes
 */
const v1Router = express.Router();

// Auth routes
v1Router.use('/auth', authRoutes);

// Health check (no auth required)
v1Router.get('/health', (req, res) => {
  const healthData = {
    status: 'OK',
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  };
  return sendSuccess(res, healthData);
});

// TODO: Add more v1 routes here
// - Bearings
// - Predictions
// - Snapshots
// - Decisions
// - Config
// - Monitoring

router.use('/v1', v1Router);

/**
 * Default 404 for /api routes
 */
router.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

module.exports = router;
