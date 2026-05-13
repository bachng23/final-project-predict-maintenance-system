const prisma = require('../config/prisma');
<<<<<<< HEAD
const { getIO } = require('./ws.service');

/**
 * Get all pending decisions with snapshot summary
=======

/**
 * Get all pending decisions for HITL review
>>>>>>> 65602107790586e966cb3f5a5342d35b62b7b020
 * @returns {Promise<Array>}
 */
const getPendingDecisions = async () => {
  const decisions = await prisma.decision.findMany({
    where: {
      decisionStatus: 'PENDING',
    },
    include: {
      snapshot: {
<<<<<<< HEAD
        select: {
          summaryJson: true,
          snapshotTs: true,
          triggerSource: true,
          bearing: {
            select: {
              bearingId: true,
              displayName: true,
            },
          },
=======
        include: {
          bearing: true,
>>>>>>> 65602107790586e966cb3f5a5342d35b62b7b020
        },
      },
    },
    orderBy: {
<<<<<<< HEAD
      openedAt: 'desc',
=======
      createdAt: 'desc',
>>>>>>> 65602107790586e966cb3f5a5342d35b62b7b020
    },
  });

  return decisions.map((d) => ({
    id: d.id,
<<<<<<< HEAD
    bearing_id: d.snapshot.bearing.bearingId,
    display_name: d.snapshot.bearing.displayName,
    recommended_action: d.recommendedAction,
    recommended_confidence: d.recommendedConfidence,
    priority: d.priority,
    safety_veto: d.safetyVeto,
    reason_summary: d.reasonSummary,
    opened_at: d.openedAt,
    snapshot_ts: d.snapshot.snapshotTs,
    trigger_source: d.snapshot.triggerSource,
    summary: d.snapshot.summaryJson,
    version: d.version,
=======
    bearingId: d.snapshot?.bearing?.bearingId || 'Unknown',
    pFail: d.failureProbability ?? 0,
    rul: d.rulHours ?? 0,
    faultType: d.predictedFault || 'Unclassified',
    recommendedAction: d.recommendedAction || 'Manual review required',
    createdAt: d.createdAt,
>>>>>>> 65602107790586e966cb3f5a5342d35b62b7b020
  }));
};

/**
<<<<<<< HEAD
 * Get decision by ID with full details
 * @param {string} id 
 * @returns {Promise<Object>}
 */
const getDecisionById = async (id) => {
  const decision = await prisma.decision.findUnique({
    where: { id },
    include: {
      snapshot: {
        include: {
          prediction: true,
          agentTranscripts: {
            orderBy: [
              { roundNo: 'asc' },
              { createdAt: 'asc' }
            ]
          }
        }
      }
    }
  });

  if (!decision) {
    throw new Error('NOT_FOUND: Decision not found');
  }

  return decision;
};

/**
 * Process an operator action on a decision with optimistic locking
 * @param {string} decisionId - UUID of the decision
 * @param {Object} data - Action data { action, override_reason, expected_version, actor }
 * @returns {Promise<Object>}
 */
const processDecisionAction = async (decisionId, data) => {
  const { action, override_reason, expected_version, actor, selected_action } = data;

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch current state for "before" audit log and checks
    const decision = await tx.decision.findUnique({
      where: { id: decisionId },
      include: { snapshot: true },
    });

    if (!decision) {
      throw new Error('NOT_FOUND: Decision not found');
    }

    // 2. Reject if already processed
    if (decision.decisionStatus !== 'PENDING') {
      throw new Error('VALIDATION_ERROR: Decision is already processed');
    }

    // 3. Optimistic locking check
    // We use updateMany to ensure atomicity of the version check
    const updatedCount = await tx.decision.updateMany({
      where: {
        id: decisionId,
        version: expected_version,
      },
      data: {
        decisionStatus: decision.safetyVeto && action === 'ACKNOWLEDGE' ? 'ACKNOWLEDGED' : 'RESOLVED',
        resolvedAt: new Date(),
        version: { increment: 1 },
      },
    });

    if (updatedCount.count === 0) {
      throw new Error('DECISION_CONFLICT: Decision was modified by another operator');
    }

    // 4. Fetch the updated record
    const updatedDecision = await tx.decision.findUnique({
      where: { id: decisionId }
    });

    // 5. Determine final action
    let finalAction = decision.recommendedAction;
    if (action === 'OVERRIDE' || action === 'REJECT') {
      finalAction = selected_action || 'CONTINUE';
    }

    // 6. Record DecisionAction
    await tx.decisionAction.create({
      data: {
        decisionId: decision.id,
        action: action,
        finalAction: finalAction,
        overrideReason: override_reason,
        actorUserId: actor.id,
        actorRole: actor.role,
        source: 'WEB_UI',
      },
    });

    // 7. Record OverridePreference if it's an override
    if (action === 'OVERRIDE') {
      await tx.overridePreference.create({
        data: {
          decisionId: decision.id,
          snapshotId: decision.snapshotId,
          aiRecommendedAction: decision.recommendedAction,
          humanSelectedAction: finalAction,
          overrideReason: override_reason,
        },
      });
    }

    // 8. Insert AuditLog
    await tx.auditLog.create({
      data: {
        entityType: 'DECISION',
        entityId: decision.id,
        action: `PROCESS_${action}`,
        actorUserId: actor.id,
        payloadJson: {
          before: {
            status: decision.decisionStatus,
            version: decision.version
          },
          after: {
            status: updatedDecision.decisionStatus,
            version: updatedDecision.version
          }
        }
      }
    });

    // 9. Emit Socket.IO event
    const io = getIO();
    if (io) {
      io.of('/decisions').emit('decision.resolved', {
        event_type: 'DECISION_RESOLVED',
        event_id: updatedDecision.id,
        ts: new Date().toISOString(),
        payload: {
          decision_id: updatedDecision.id,
          status: updatedDecision.decisionStatus,
          action: action,
          final_action: finalAction
        }
      });
    }

    return updatedDecision;
  });
=======
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
>>>>>>> 65602107790586e966cb3f5a5342d35b62b7b020
};

module.exports = {
  getPendingDecisions,
<<<<<<< HEAD
  getDecisionById,
  processDecisionAction,
=======
  submitDecisionAction,
>>>>>>> 65602107790586e966cb3f5a5342d35b62b7b020
};
