require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initWS } = require('./services/ws.service');

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

initWS(httpServer).then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
