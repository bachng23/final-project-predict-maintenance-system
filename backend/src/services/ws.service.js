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

let io = null;

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
// socket.io namespace setup
// ---------------------------------------------------------------------------

function setupNamespaces() {
  // /predictions — clients join room by bearingId
  io.of('/predictions').on('connection', (socket) => {
    socket.on('subscribe', (bearingId) => {
      socket.join(`bearing:${bearingId}`);
    });
    socket.on('unsubscribe', (bearingId) => {
      socket.leave(`bearing:${bearingId}`);
    });
  });

  // /snapshots — same room pattern
  io.of('/snapshots').on('connection', (socket) => {
    socket.on('subscribe', (bearingId) => {
      socket.join(`bearing:${bearingId}`);
    });
    socket.on('unsubscribe', (bearingId) => {
      socket.leave(`bearing:${bearingId}`);
    });
  });

  // /decisions — Phase 5 HITL placeholder
  io.of('/decisions').on('connection', (socket) => {
    socket.on('decision', (data) => {
      // Will be forwarded to orchestrator in Phase 5
      io.of('/decisions').emit('decision:broadcast', data);
    });
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function initWS(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
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
