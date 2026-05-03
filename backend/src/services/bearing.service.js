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
          sample_ts: 'desc',
        },
        take: 1,
      },
      snapshots: {
        include: {
          decision: true,
        },
        orderBy: {
          snapshot_ts: 'desc',
        },
        take: 1,
      },
    },
    orderBy: {
      bearing_id: 'asc',
    },
  });

  // Transform to follow the 'Bearing Summary' contract from TEAM_SHARED_CONTRACT.md
  return bearings.map((bearing) => {
    const latestPrediction = bearing.predictions[0] || {};
    const latestSnapshot = bearing.snapshots[0] || {};
    const latestDecision = latestSnapshot.decision || {};

    return {
      id: bearing.id,
      bearing_id: bearing.bearing_id,
      display_name: bearing.display_name,
      dataset_source: bearing.dataset_source,
      condition_label: bearing.condition_label,
      status: bearing.status,
      // Mapping fields from latest prediction
      latest_prediction_at: latestPrediction.sample_ts || null,
      health_score: latestPrediction.health_score ?? null,
      p_fail: latestPrediction.p_fail ?? null,
      rul_hours: latestPrediction.rul_minutes ? latestPrediction.rul_minutes / 60 : null,
      fault_type: latestPrediction.fault_type || null,
      fault_confidence: latestPrediction.fault_confidence ?? null,
      // Mapping fields from latest decision
      priority: latestDecision.priority || null,
      last_decision_status: latestDecision.decision_status || null,
      // Keep technical IDs if needed
      latest_prediction_id: latestPrediction.id || null,
      latest_snapshot_id: latestSnapshot.id || null,
      latest_decision_id: latestDecision.id || null,
      updated_at: bearing.updated_at,
    };
  });
};

/**
 * Get prediction history for a specific bearing
 * @param {string} bearingId - Internal UUID of the bearing
 * @param {Object} filters - Optional filters (limit, startDate, endDate)
 * @returns {Promise<Array>}
 */
const getPredictionsByBearingId = async (bearingId, filters = {}) => {
  const { limit = 100, startDate, endDate } = filters;
  
  const where = {
    bearing_id: bearingId,
  };

  if (startDate || endDate) {
    where.sample_ts = {};
    if (startDate) where.sample_ts.gte = new Date(startDate);
    if (endDate) where.sample_ts.lte = new Date(endDate);
  }

  const predictions = await prisma.prediction.findMany({
    where,
    orderBy: {
      sample_ts: 'desc',
    },
    take: limit,
  });

  // Transform to follow the 'Prediction Detail' contract
  return predictions.map((p) => ({
    prediction_id: p.id,
    bearing_id: p.bearing_id,
    file_idx: p.file_idx,
    sample_ts: p.sample_ts,
    rul_hours: p.rul_minutes ? p.rul_minutes / 60 : null,
    rul_lower_hours: p.rul_lower_minutes ? p.rul_lower_minutes / 60 : null,
    rul_upper_hours: p.rul_upper_minutes ? p.rul_upper_minutes / 60 : null,
    p_fail: p.p_fail,
    health_score: p.health_score,
    uncertainty_score: p.rul_uncertainty,
    fault_type: p.fault_type,
    fault_confidence: p.fault_confidence,
    stat_score: p.stat_score,
    rul_drop_score: p.rul_drop_score,
    hybrid_score: p.hybrid_score,
    threshold_tau: p.threshold_tau,
    model_version: p.model_version,
    created_at: p.created_at,
  }));
};

module.exports = {
  getAllBearingsWithLatestStatus,
  getPredictionsByBearingId,
};
