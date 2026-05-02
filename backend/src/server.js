require('dotenv').config();

const DEFAULT_ACCESS_SECRET = 'your-secret-access-key-change-in-production';
const DEFAULT_REFRESH_SECRET = 'your-secret-refresh-key-change-in-production';

const validateJwtSecrets = () => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  const production = process.env.NODE_ENV === 'production';

  if (!accessSecret) {
    throw new Error('JWT_ACCESS_SECRET is required');
  }

  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET is required');
  }

  if (production && accessSecret === DEFAULT_ACCESS_SECRET) {
    throw new Error('JWT_ACCESS_SECRET must not use the default placeholder in production');
  }

  if (production && refreshSecret === DEFAULT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET must not use the default placeholder in production');
  }
};

validateJwtSecrets();

const app = require('./app');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const server = app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Backend Server Started                                    ║
╠════════════════════════════════════════════════════════════╣
║  Host:    ${HOST.padEnd(54)}║
║  Port:    ${String(PORT).padEnd(54)}║
║  Env:     ${(process.env.NODE_ENV || 'development').padEnd(54)}║
║  API:     http://${HOST}:${PORT}/api/v1                   ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
