const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  const statusCode = err.message === 'UNAUTHORIZED' ? 401 : 
                     err.message === 'FORBIDDEN' ? 403 : 
                     err.message.includes('NOT_FOUND') ? 404 : 500;

  res.status(statusCode).json({
    error: {
      code: err.message || 'INTERNAL_ERROR',
      message: err.message || 'Something went wrong!',
      detail: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
});

module.exports = app;
