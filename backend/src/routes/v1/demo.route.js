const express = require('express');
const { exec } = require('child_process');
const router = express.Router();

let demoProcess = null;

/**
 * POST /api/v1/demo/start
 * Triggers the ai_services Kafka producer to stream a bearing dataset.
 * Body: { bearing_id: "Bearing1_3", speed?: 1.0 }
 */
router.post('/start', (req, res) => {
  if (demoProcess && !demoProcess.killed) {
    return res.status(409).json({ success: false, message: 'Demo already running' });
  }

  const bearingId = req.body.bearing_id || 'Bearing1_3';
  const speed = parseFloat(req.body.speed) || 1.0;

  // Calls the ingestion producer via docker exec (adjust service name as needed)
  const cmd = `docker exec ingestion python -m producer --bearing ${bearingId} --speed ${speed}`;
  demoProcess = exec(cmd, (err) => {
    if (err && !err.killed) {
      console.warn('[demo] producer exited:', err.message);
    }
    demoProcess = null;
  });

  res.json({ success: true, bearing_id: bearingId, speed });
});

/**
 * POST /api/v1/demo/stop
 */
router.post('/stop', (req, res) => {
  if (demoProcess && !demoProcess.killed) {
    demoProcess.kill('SIGTERM');
  }
  res.json({ success: true });
});

module.exports = router;
