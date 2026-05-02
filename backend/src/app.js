const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');

const app = express();

// Global Middlewares
app.use(helmet());
<<<<<<< HEAD

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || '*', // Allow specific origin or all in dev
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true, // Allow cookies if needed
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
app.use(cors(corsOptions));

=======
app.use(cors());
>>>>>>> 48c12d126afcf34b7beb469985f60eceadb84c9a
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', routes);
// Xử lý Route Not Found (404)
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route không tồn tại!' });
});

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
