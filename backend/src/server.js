require('dotenv').config();
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
