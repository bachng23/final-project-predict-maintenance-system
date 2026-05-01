const prisma = require('./prisma.service');

class DecisionService {
  async getPendingDecisions(filters = {}) {
    const { priority, bearing_id, safety_veto, limit = 20, offset = 0 } = filters;

    const where = {
      decisionStatus: 'PENDING',
    };

    if (priority) where.priority = priority;
    if (safety_veto) where.safetyVeto = safety_veto === 'true';
    if (bearing_id) where.snapshot = { bearing: { bearingId: bearing_id } };

    const decisions = await prisma.decision.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { openedAt: 'desc' }],
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        snapshot: true,
      },
    });

    // Map to Decision Summary contract 5.5
    return decisions.map((d) => ({
      decision_id: d.id,
      snapshot_id: d.snapshotId,
      bearing_id: d.snapshot.bearingId,
      decision_status: d.decisionStatus,
      recommended_action: d.recommendedAction,
      recommended_confidence: d.recommendedConfidence,
      priority: d.priority,
      safety_veto: d.safetyVeto,
      reason_summary: d.reasonSummary,
      opened_at: d.openedAt,
      resolved_at: d.resolvedAt,
    }));
  }

  async getDecisionById(id) {
    const decision = await prisma.decision.findUnique({
      where: { id },
      include: {
        snapshot: {
          include: {
            prediction: true,
            agentTranscripts: {
              orderBy: { roundNo: 'asc' },
            },
          },
        },
        decisionActions: {
          include: {
            actor: {
              select: { username: true, fullName: true },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!decision) {
      throw new Error('DECISION_NOT_FOUND');
    }

    // Determine available actions based on business rules
    let available_operator_actions = ['APPROVE', 'OVERRIDE', 'REJECT'];
    if (decision.safetyVeto) {
      available_operator_actions = ['ACKNOWLEDGE'];
    }

    return {
      decision,
      snapshot: decision.snapshot,
      latest_prediction: decision.snapshot.prediction,
      agent_transcript: decision.snapshot.agentTranscripts,
      available_operator_actions,
    };
  }

  async submitAction(decisionId, actionData, actorUserId) {
    const { operator_action, final_action, override_reason } = actionData;

    const decision = await prisma.decision.findUnique({
      where: { id: decisionId },
    });

    if (!decision) throw new Error('DECISION_NOT_FOUND');
    if (decision.decisionStatus !== 'PENDING') throw new Error('DECISION_ALREADY_RESOLVED');

    // Business rules
    if (decision.safetyVeto && operator_action !== 'ACKNOWLEDGE') {
      throw new Error('INVALID_OPERATOR_ACTION'); // Only ACKNOWLEDGE allowed for safety veto
    }

    if (operator_action === 'OVERRIDE' && !final_action) {
      throw new Error('INVALID_OPERATOR_ACTION'); // final_action required for override
    }

    const resolvedFinalAction = operator_action === 'APPROVE' ? decision.recommendedAction : (final_action || decision.recommendedAction);

    // Update Decision
    const updatedDecision = await prisma.decision.update({
      where: { id: decisionId },
      data: {
        decisionStatus: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    // Create Decision Action Log
    const user = await prisma.user.findUnique({ where: { id: actorUserId } });

    await prisma.decisionAction.create({
      data: {
        decisionId,
        action: operator_action,
        finalAction: resolvedFinalAction,
        overrideReason: override_reason,
        actorUserId,
        actorRole: user.role,
        source: 'WEB_UI',
        submittedAt: new Date(),
      },
    });

    // If override, create OverridePreference
    if (operator_action === 'OVERRIDE') {
      await prisma.overridePreference.create({
        data: {
          decisionId,
          snapshotId: decision.snapshotId,
          aiRecommendedAction: decision.recommendedAction,
          humanSelectedAction: resolvedFinalAction,
          overrideReason: override_reason,
          confidenceGap: decision.recommendedConfidence,
        },
      });
    }

    return {
      decision_id: updatedDecision.id,
      decision_status: updatedDecision.decisionStatus,
      operator_action,
      final_action: resolvedFinalAction,
      resolved_at: updatedDecision.resolvedAt,
    };
  }

  async getDecisionHistory(filters = {}) {
    const { bearing_id, action, limit = 20, offset = 0 } = filters;

    const where = {
      decisionStatus: { not: 'PENDING' },
    };

    if (bearing_id) where.snapshot = { bearing: { bearingId: bearing_id } };

    const decisions = await prisma.decision.findMany({
      where,
      orderBy: { resolvedAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        snapshot: true,
        decisionActions: {
          take: 1,
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    return decisions;
  }
}

module.exports = new DecisionService();
