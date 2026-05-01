const prisma = require('./prisma.service');

class SnapshotService {
  async getAllSnapshots(filters = {}) {
    const { bearing_id, status, trigger_source, limit = 20, offset = 0 } = filters;

    const where = {};
    if (bearing_id) where.bearing = { bearingId: bearing_id };
    if (status) where.status = status;
    if (trigger_source) where.triggerSource = trigger_source;

    const snapshots = await prisma.snapshot.findMany({
      where,
      orderBy: { snapshotTs: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        prediction: true,
      },
    });

    // Map to Snapshot Summary contract 5.4
    return snapshots.map((s) => ({
      snapshot_id: s.id,
      bearing_id: s.bearingId,
      prediction_id: s.predictionId,
      snapshot_ts: s.snapshotTs,
      trigger_source: s.triggerSource,
      status: s.status,
      summary: s.summaryJson || {
        p_fail: s.prediction?.pFail,
        rul_hours: s.prediction?.rulHours,
        health_score: s.prediction?.healthScore,
        fault_type: s.prediction?.faultType,
      },
    }));
  }

  async getSnapshotById(id) {
    const snapshot = await prisma.snapshot.findUnique({
      where: { id },
      include: {
        prediction: true,
        agentTranscripts: {
          orderBy: { roundNo: 'asc' },
        },
      },
    });

    if (!snapshot) {
      throw new Error('SNAPSHOT_NOT_FOUND');
    }

    return snapshot;
  }
}

module.exports = new SnapshotService();
