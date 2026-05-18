const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');

const router = express.Router();

// __dirname = backend/src/routes/v1  →  go up 4 levels to repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const PIPELINE_SCRIPT = path.join(REPO_ROOT, 'ai_services', 'run_pipeline.sh');
const DATA_ROOT = process.env.DATA_ROOT || path.join(REPO_ROOT, 'data', 'xjtu-sy');

// condition folder names inside DATA_ROOT
const CONDITION_FOLDERS = ['35Hz12kN', '37.5Hz11kN', '40Hz10kN'];

let demoProcess = null;
let currentBearing = null;
let demoTimeout = null;

// Maximum runtime for a demo pipeline (30 minutes). Prevents zombie processes
// if the client never calls /stop or the server restarts unexpectedly.
const DEMO_MAX_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// GET /api/v1/demo/bearings
// Returns all available bearing IDs from the dataset folders.
// ---------------------------------------------------------------------------
router.get('/bearings', requireAuth, (req, res) => {
  try {
    const bearings = [];
    for (const folder of CONDITION_FOLDERS) {
      const dir = path.join(DATA_ROOT, folder);
      if (!fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory() && /^Bearing\d+_\d+$/.test(name)) {
          const csvCount = fs.readdirSync(full).filter(f => f.endsWith('.csv')).length;
          bearings.push({ id: name, condition: folder, files: csvCount });
        }
      }
    }
    res.json({ bearings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to read bearing dataset', error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/demo/status
// ---------------------------------------------------------------------------
router.get('/status', requireAuth, (req, res) => {
  res.json({
    running: !!(demoProcess && !demoProcess.killed),
    bearing_id: currentBearing,
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/demo/start
// Body: { bearing_id: "Bearing1_3", speed: 30 }
// ---------------------------------------------------------------------------
router.post('/start', requireAuth, requireRole(['ADMIN', 'OPERATOR']), (req, res) => {
  if (demoProcess && !demoProcess.killed) {
    return res.status(409).json({ success: false, message: 'Demo already running', bearing_id: currentBearing });
  }

  const bearingId = (req.body.bearing_id || 'Bearing1_3').trim();
  const speed = Math.min(Math.max(parseFloat(req.body.speed) || 100, 1), 2000);

  if (!/^Bearing\d+_\d+$/.test(bearingId)) {
    return res.status(400).json({ success: false, message: 'Invalid bearing_id format' });
  }

  console.log(`[demo] Starting pipeline: ${bearingId} speed=${speed}x`);

  demoProcess = spawn('bash', [PIPELINE_SCRIPT, bearingId, String(speed)], {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  demoProcess.stdout.on('data', d => process.stdout.write(`[demo] ${d}`));
  demoProcess.stderr.on('data', d => process.stderr.write(`[demo] ${d}`));
  demoProcess.on('close', (code) => {
    console.log(`[demo] Pipeline exited (code ${code})`);
    clearTimeout(demoTimeout);
    demoTimeout = null;
    demoProcess = null;
    currentBearing = null;
  });

  demoTimeout = setTimeout(() => {
    if (demoProcess && !demoProcess.killed) {
      console.warn('[demo] Max runtime exceeded — killing pipeline');
      demoProcess.kill('SIGTERM');
    }
  }, DEMO_MAX_MS);

  currentBearing = bearingId;
  res.json({ success: true, bearing_id: bearingId, speed });
});

// ---------------------------------------------------------------------------
// POST /api/v1/demo/stop
// ---------------------------------------------------------------------------
router.post('/stop', requireAuth, requireRole(['ADMIN', 'OPERATOR']), (req, res) => {
  if (demoProcess && !demoProcess.killed) {
    demoProcess.kill('SIGTERM');
  }
  clearTimeout(demoTimeout);
  demoTimeout = null;
  demoProcess = null;
  currentBearing = null;
  res.json({ success: true });
});

module.exports = router;
