const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');

const app = express();

// Global Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', routes);

// Handle Route Not Found (404)
app.use((req, res, next) => {
  res.status(404).json({ 
    success: false,
    message: `Route ${req.originalUrl} not found!` 
  });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';

  // Map error messages to HTTP status codes
  if (err.message === 'UNAUTHORIZED') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (err.message === 'FORBIDDEN') {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
  } else if (err.message.includes('NOT_FOUND')) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'PrismaClientKnownRequestError') {
    // Handle Prisma specific errors
    if (err.code === 'P2002') {
      statusCode = 409;
      errorCode = 'DUPLICATE_ENTRY';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      errorCode = 'RECORD_NOT_FOUND';
    }
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'An unexpected error occurred',
      detail: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
});

module.exports = app;
