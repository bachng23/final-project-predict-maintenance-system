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

/**
 * Get prediction history for a specific bearing
 * @param {string} bearingId - Internal UUID of the bearing
 * @param {number} limit - Number of records to return
 * @returns {Promise<Array>}
 */
const getPredictionsByBearingId = async (bearingId, limit = 100) => {
  const predictions = await prisma.prediction.findMany({
    where: {
      bearingId: bearingId,
    },
    orderBy: {
      sampleTs: 'desc',
    },
    take: limit,
  });

  // Transform to follow the 'Prediction Detail' contract
  return predictions.map((p) => ({
    prediction_id: p.id,
    bearing_id: p.bearingId,
    file_idx: p.fileIdx,
    sample_ts: p.sampleTs,
    rul_hours: p.rulMinutes ? p.rulMinutes / 60 : null,
    rul_lower_hours: p.rulLowerMinutes ? p.rulLowerMinutes / 60 : null,
    rul_upper_hours: p.rulUpperMinutes ? p.rulUpperMinutes / 60 : null,
    p_fail: p.pFail,
    health_score: p.healthScore,
    uncertainty_score: p.rulUncertainty,
    fault_type: p.faultType,
    fault_confidence: p.faultConfidence,
    stat_score: p.statScore,
    rul_drop_score: p.rulDropScore,
    hybrid_score: p.hybridScore,
    threshold_tau: p.thresholdTau,
    model_version: p.modelVersion,
    created_at: p.createdAt,
  }));
};

module.exports = {
  getAllBearingsWithLatestStatus,
  getPredictionsByBearingId,
};
