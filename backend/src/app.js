const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const requestContextMiddleware = require('./middlewares/request-context');
const { AppError } = require('./utils/errors');
const { sendError } = require('./utils/response');

const app = express();

// Global Middlewares
app.use(requestContextMiddleware);
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', routes);

// Handle Route Not Found (404)
app.use((req, res) => {
  sendError(res, new AppError(404, 'NOT_FOUND', `Route ${req.originalUrl} not found!`));
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
  const code = err.code || (statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR');

  sendError(res, {
    statusCode,
    code,
    message: err.message || 'An unexpected error occurred',
    detail: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;
