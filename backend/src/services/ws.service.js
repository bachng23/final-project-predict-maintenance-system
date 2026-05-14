/**
 * WebSocket service: attaches socket.io to the HTTP server and bridges
 * Kafka topics (pdm.predictions, pdm.snapshots) to connected clients.
 *
 * Namespaces
 *   /predictions  — real-time PredictionRecord per bearing
 *   /snapshots    — SnapshotPayload when anomaly triggers
 *   /decisions    — HITL override channel (Phase 5 prep)
 */

const { Kafka } = require('kafkajs');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const connectionManager = require('./connection.manager');

let io = null;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

// ---------------------------------------------------------------------------
// Kafka consumer helpers
// ---------------------------------------------------------------------------

function buildKafka() {
  return new Kafka({
    clientId: 'backend-ws-bridge',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  });
}

async function startKafkaConsumer(kafka) {
  const consumer = kafka.consumer({ groupId: 'backend-ws-bridge' });

  await consumer.connect();
  await consumer.subscribe({ topics: ['pdm.predictions', 'pdm.snapshots'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!io) return;

      let payload;
      try {
        payload = JSON.parse(message.value.toString());
      } catch {
        return;
      }

      if (topic === 'pdm.predictions') {
        const room = `bearing:${payload.bearing_id}`;
        io.of('/predictions').to(room).emit('prediction', payload);
        io.of('/predictions').emit('prediction:all', payload);
      } else if (topic === 'pdm.snapshots') {
        const room = `bearing:${payload.bearing_id}`;
        io.of('/snapshots').to(room).emit('snapshot', payload);
        io.of('/snapshots').emit('snapshot:all', payload);
      }
    },
  });

  return consumer;
}

// ---------------------------------------------------------------------------
// socket.io middleware & events
// ---------------------------------------------------------------------------

function authMiddleware(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    console.error(`[ws] Connection rejected: No token provided (Socket ID: ${socket.id})`);
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded; // Attach user info to socket
    next();
  } catch (err) {
    console.error(`[ws] Connection rejected: Invalid token (Socket ID: ${socket.id}) - ${err.message}`);
    next(new Error('Authentication error: Invalid token'));
  }
}

function handleConnection(socket) {
  const userId = socket.user?.id || socket.user?.sub || 'anonymous';
  connectionManager.addConnection(userId, socket.id);
  
  console.log(`[ws] User connected: ${userId} (Socket ID: ${socket.id})`);
  console.log(`[ws] Online users count: ${connectionManager.getOnlineUsers().length}`);

  socket.on('disconnect', (reason) => {
    connectionManager.removeConnection(socket.id);
    console.log(`[ws] User disconnected: ${userId} (Socket ID: ${socket.id}) - Reason: ${reason}`);
    console.log(`[ws] Online users count: ${connectionManager.getOnlineUsers().length}`);
  });
}

// ---------------------------------------------------------------------------
// socket.io namespace setup
// ---------------------------------------------------------------------------

function setupNamespaces() {
  // Apply auth middleware to all namespaces
  io.use(authMiddleware);
  io.of('/predictions').use(authMiddleware);
  io.of('/snapshots').use(authMiddleware);
  io.of('/decisions').use(authMiddleware);

  // Root namespace
  io.on('connection', handleConnection);

  // /predictions — clients join room by bearingId
  io.of('/predictions').on('connection', (socket) => {
    handleConnection(socket);
    socket.on('subscribe', (bearingId) => {
      console.log(`[ws] User ${socket.user?.id} subscribing to prediction room: bearing:${bearingId}`);
      socket.join(`bearing:${bearingId}`);
    });
    socket.on('unsubscribe', (bearingId) => {
      console.log(`[ws] User ${socket.user?.id} unsubscribing from prediction room: bearing:${bearingId}`);
      socket.leave(`bearing:${bearingId}`);
    });
  });

  // /snapshots — same room pattern
  io.of('/snapshots').on('connection', (socket) => {
    handleConnection(socket);
    socket.on('subscribe', (bearingId) => {
      console.log(`[ws] User ${socket.user?.id} subscribing to snapshot room: bearing:${bearingId}`);
      socket.join(`bearing:${bearingId}`);
    });
    socket.on('unsubscribe', (bearingId) => {
      console.log(`[ws] User ${socket.user?.id} unsubscribing from snapshot room: bearing:${bearingId}`);
      socket.leave(`bearing:${bearingId}`);
    });
  });

  // /decisions — Phase 5 HITL placeholder
  io.of('/decisions').on('connection', (socket) => {
    handleConnection(socket);
    socket.on('decision', (data) => {
      console.log(`[ws] Decision received from user ${socket.user?.id}:`, data);
      // Will be forwarded to orchestrator in Phase 5
      io.of('/decisions').emit('decision:broadcast', data);
    });
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function initWS(httpServer) {
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  setupNamespaces();

  // Start Kafka consumer — non-fatal if Kafka is unavailable at boot
  try {
    const kafka = buildKafka();
    await startKafkaConsumer(kafka);
    console.log('[ws] Kafka consumer connected, bridging pdm.predictions + pdm.snapshots');
  } catch (err) {
    console.warn('[ws] Kafka unavailable — WebSocket server running without Kafka bridge:', err.message);
  }

  return io;
}

function getIO() {
  return io;
}

module.exports = { initWS, getIO };
