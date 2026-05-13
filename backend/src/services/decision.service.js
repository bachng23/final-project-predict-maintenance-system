const prisma = require('../config/prisma');

/**
 * Get all pending decisions for HITL review
 * @returns {Promise<Array>}
 */
const getPendingDecisions = async () => {
  const decisions = await prisma.decision.findMany({
    where: {
      decisionStatus: 'PENDING',
    },
    include: {
      snapshot: {
        include: {
          bearing: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return decisions.map((d) => ({
    id: d.id,
    bearingId: d.snapshot?.bearing?.bearingId || 'Unknown',
    pFail: d.failureProbability ?? 0,
    rul: d.rulHours ?? 0,
    faultType: d.predictedFault || 'Unclassified',
    recommendedAction: d.recommendedAction || 'Manual review required',
    createdAt: d.createdAt,
  }));
};

/**
 * Submit an action for a decision (Approve, Override, Reject)
 * @param {string} decisionId 
 * @param {string} action 
 * @param {string} reason 
 * @returns {Promise<Object>}
 */
const submitDecisionAction = async (decisionId, action, reason) => {
  const statusMap = {
    approve: 'RESOLVED',
    override: 'RESOLVED',
    reject: 'ACKNOWLEDGED',
  };

  const status = statusMap[action.toLowerCase()];
  if (!status) {
    throw new Error(`Invalid action: ${action}`);
  }

  // Update the decision status
  const updatedDecision = await prisma.decision.update({
    where: { id: decisionId },
    data: {
      decisionStatus: status,
    },
  });

  // Log the action in decision_actions table if it exists in schema
  // Based on migration, there is a decision_actions table
  await prisma.decisionAction.create({
    data: {
      decisionId: decisionId,
      actionType: action.toUpperCase(),
      reason: reason || null,
      actor: 'HITL_USER',
    },
  });

  return updatedDecision;
};

module.exports = {
  getPendingDecisions,
  submitDecisionAction,
};
