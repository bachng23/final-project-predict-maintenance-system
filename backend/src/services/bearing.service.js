const prisma = require('./prisma.service');

class BearingService {
  async getAllBearings(filters = {}) {
    const { status, limit = 10, offset = 0 } = filters;

    const where = {};
    if (status) {
      where.status = status;
    }

    const bearings = await prisma.bearing.findMany({
      where,
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        predictions: {
          orderBy: { sampleTs: 'desc' },
          take: 1,
        },
        snapshots: {
          orderBy: { snapshotTs: 'desc' },
          take: 1,
          include: {
            decision: true,
          },
        },
      },
    });

    // Map to Bearing Summary contract
    return bearings.map((b) => {
      const latestPrediction = b.predictions[0] || {};
      const latestSnapshot = b.snapshots[0] || {};
      const latestDecision = latestSnapshot.decision || {};

      return {
        bearing_id: b.bearingId,
        display_name: b.displayName,
        condition_label: b.conditionLabel,
        status: b.status,
        latest_prediction_at: latestPrediction.sampleTs || null,
        health_score: latestPrediction.healthScore || null,
        rul_hours: latestPrediction.rulHours || null,
        p_fail: latestPrediction.pFail || null,
        fault_type: latestPrediction.faultType || null,
        fault_confidence: latestPrediction.faultConfidence || null,
        priority: latestDecision.priority || null,
        last_decision_status: latestDecision.decisionStatus || null,
      };
    });
  }

  async getBearingById(bearingId) {
    const bearing = await prisma.bearing.findUnique({
      where: { bearingId },
      include: {
        predictions: {
          orderBy: { sampleTs: 'desc' },
          take: 1,
        },
        snapshots: {
          orderBy: { snapshotTs: 'desc' },
          take: 1,
          include: {
            decision: true,
          },
        },
      },
    });

    if (!bearing) {
      throw new Error('BEARING_NOT_FOUND');
    }

    const latestPrediction = bearing.predictions[0] || {};
    const latestSnapshot = bearing.snapshots[0] || {};
    const latestDecision = latestSnapshot.decision || {};

    // Response shape per contract 6.4
    return {
      ...bearing,
      latest_prediction: latestPrediction,
      latest_decision: latestDecision,
    };
  }
}

module.exports = new BearingService();
