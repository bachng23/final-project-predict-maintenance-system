const prisma = require('../config/prisma');

/**
 * Get all bearings with their latest status (from predictions and snapshots)
 * @returns {Promise<Array>}
 */
const getAllBearingsWithLatestStatus = async () => {
  const bearings = await prisma.bearing.findMany({
    where: {
      active: true,
    },
    include: {
      predictions: {
        orderBy: {
          sampleTs: 'desc',
        },
        take: 1,
      },
      snapshots: {
        include: {
          decision: true,
        },
        orderBy: {
          snapshotTs: 'desc',
        },
        take: 1,
      },
    },
    orderBy: {
      bearingId: 'asc',
    },
  });

  // Transform to follow the 'Bearing Summary' contract from TEAM_SHARED_CONTRACT.md
  return bearings.map((bearing) => {
    const latestPrediction = bearing.predictions[0] || {};
    const latestSnapshot = bearing.snapshots[0] || {};
    const latestDecision = latestSnapshot.decision || {};

    return {
      id: bearing.id,
      bearing_id: bearing.bearingId,
      display_name: bearing.displayName,
      dataset_source: bearing.datasetSource,
      condition_label: bearing.conditionLabel,
      status: bearing.status,
      // Mapping fields from latest prediction
      latest_prediction_at: latestPrediction.sampleTs || null,
      health_score: latestPrediction.healthScore ?? null,
      p_fail: latestPrediction.pFail ?? null,
      rul_hours: latestPrediction.rulMinutes ? latestPrediction.rulMinutes / 60 : null,
      fault_type: latestPrediction.faultType || null,
      fault_confidence: latestPrediction.faultConfidence ?? null,
      // Mapping fields from latest decision
      priority: latestDecision.priority || null,
      last_decision_status: latestDecision.decisionStatus || null,
      // Keep technical IDs if needed
      latest_prediction_id: latestPrediction.id || null,
      latest_snapshot_id: latestSnapshot.id || null,
      latest_decision_id: latestDecision.id || null,
      updated_at: bearing.updatedAt,
    };
  });
};

module.exports = {
  getAllBearingsWithLatestStatus,
};
