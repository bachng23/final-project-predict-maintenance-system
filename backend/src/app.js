const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const requestContextMiddleware = require('./middlewares/request-context');
const { sendError } = require('./utils/response');
const { ErrorCodes } = require('./utils/errors');

const app = express();

// ============================================================================
// Middlewares - Order matters!
// ============================================================================

// Add request ID to all requests
app.use(requestContextMiddleware);

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// HTTP request logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// Routes
// ============================================================================

// All API routes go through /api prefix
app.use('/api', routes);

// ============================================================================
// Error Handling
// ============================================================================

// 404 Not Found handler
app.use((req, res, next) => {
  return sendError(
    res,
    ErrorCodes.NOT_FOUND,
    `Route ${req.method} ${req.path} not found`,
    null,
    404,
    req.requestId
  );
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return sendError(
      res,
      ErrorCodes.INVALID_CONFIG_VALUE,
      'Validation error',
      err.message,
      400,
      req.requestId
    );
  }

  // Generic error response
  return sendError(
    res,
    ErrorCodes.INTERNAL_ERROR,
    'Internal server error',
    process.env.NODE_ENV === 'development' ? err.message : undefined,
    err.statusCode || 500,
    req.requestId
  );
});

module.exports = app;
