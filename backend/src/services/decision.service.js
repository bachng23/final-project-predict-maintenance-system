const prisma = require('../config/prisma');
const { getIO } = require('./ws.service');

/**
 * Get pending decisions with snapshot summary
 * @param {Object} params
 * @param {number} params.page
 * @param {number} params.limit
 * @returns {Promise<{data: Array, total: number, page: number, limit: number}>}
 */
const getPendingDecisions = async ({ page, limit }) => {
  const skip = (page - 1) * limit;
  const where = {
    decisionStatus: 'PENDING',
  };

  const [total, decisions] = await prisma.$transaction([
    prisma.decision.count({ where }),
    prisma.decision.findMany({
      where,
      include: {
        snapshot: {
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
          },
        },
      },
      orderBy: {
        openedAt: 'desc',
      },
      skip,
      take: limit,
    }),
  ]);

  const data = decisions.map((d) => {
    const summary = d.snapshot.summaryJson || {};
    return {
      id: d.id,
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
      summary: summary,
      version: d.version,
      // Restore top-level fields for frontend compatibility (PR #58)
      pFail: summary.pFail ?? 0,
      rul: summary.rul ?? 0,
    };
  });

  return {
    data,
    total,
    page,
    limit,
  };
};

/**
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

  const { updatedDecision, finalAction } = await prisma.$transaction(async (tx) => {
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
      const err = new Error('Decision is already processed');
      err.code = 'ALREADY_PROCESSED';
      throw err;
    }

    const newStatus = decision.safetyVeto && action === 'ACKNOWLEDGE' ? 'ACKNOWLEDGED' : 'RESOLVED';

    // 3. Optimistic locking check (only when expected_version is provided)
    if (expected_version !== undefined) {
      const updatedCount = await tx.decision.updateMany({
        where: { id: decisionId, version: expected_version },
        data: { decisionStatus: newStatus, resolvedAt: new Date(), version: { increment: 1 } },
      });

      if (updatedCount.count === 0) {
        const err = new Error('Decision was modified by another operator');
        err.code = 'DECISION_CONFLICT';
        throw err;
      }
    } else {
      // Fallback: no optimistic lock (deprecated — supports old frontend)
      await tx.decision.update({
        where: { id: decisionId },
        data: { decisionStatus: newStatus, resolvedAt: new Date(), version: { increment: 1 } },
      });
    }

    // 4. Fetch the updated record
    const updatedDecision = await tx.decision.findUnique({ where: { id: decisionId } });

    // 5. Determine final action
    let txFinalAction = decision.recommendedAction;
    if (action === 'OVERRIDE' || action === 'REJECT') {
      txFinalAction = selected_action || 'CONTINUE';
    }

    // 6. Record DecisionAction
    await tx.decisionAction.create({
      data: {
        decisionId: decision.id,
        action: action,
        finalAction: txFinalAction,
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
          humanSelectedAction: txFinalAction,
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
          before: { status: decision.decisionStatus, version: decision.version },
          after: { status: updatedDecision.decisionStatus, version: updatedDecision.version },
        },
      },
    });

    return { updatedDecision, finalAction: txFinalAction };
  });

  // 9. Emit Socket.IO event AFTER transaction commits — prevents clients receiving
  //    stale events if the transaction rolls back after the emit.
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
        final_action: finalAction,
      },
    });
  }

  return updatedDecision;
};

module.exports = {
  getPendingDecisions,
  getDecisionById,
  processDecisionAction,
};
