const { z } = require('zod');
const decisionService = require('../services/decision.service');

// Zod schema for decision action
const decisionActionSchema = z.object({
  // Make action case-insensitive (Recommendation Step 2)
  action: z.string().transform(v => v.toUpperCase()).pipe(
    z.enum(['APPROVE', 'OVERRIDE', 'REJECT', 'ACKNOWLEDGE'])
  ),
  overrideReason: z.string().optional(),
  // Make expectedVersion optional for backward compatibility (Recommendation Step 3)
  expectedVersion: z.number().optional(),
  selected_action: z.enum(['CONTINUE', 'INSPECT', 'MAINTAIN', 'STOP']).optional(),
}).refine(data => {
  if (data.action === 'OVERRIDE') {
    return data.overrideReason && data.overrideReason.length >= 10;
  }
  return true;
}, {
  message: "Override reason must be at least 10 characters long when action is OVERRIDE",
  path: ["overrideReason"]
});

/**
 * GET /api/decisions/pending
 */
const getPendingDecisions = async (req, res, next) => {
  try {
    const decisions = await decisionService.getPendingDecisions();
    res.json({
      success: true,
      count: decisions.length,
      data: decisions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/decisions/:id
 */
const getDecisionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const decision = await decisionService.getDecisionById(id);
    res.json({
      success: true,
      data: decision,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/decisions/:id/action
 */
const handleDecisionAction = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const validatedData = decisionActionSchema.parse(req.body);

    const updatedDecision = await decisionService.processDecisionAction(id, {
      action: validatedData.action,
      override_reason: validatedData.overrideReason,
      expected_version: validatedData.expectedVersion,
      selected_action: validatedData.selected_action,
      actor: req.user, // Passed from auth middleware
    });

    res.json({
      success: true,
      message: `Decision ${validatedData.action} successfully`,
      data: updatedDecision,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.errors?.[0]?.message || 'Validation failed',
          detail: error.errors,
        },
      });
    }

    if (error.code === 'ALREADY_PROCESSED') {
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_PROCESSED', message: error.message },
      });
    }

    if (error.code === 'DECISION_CONFLICT') {
      return res.status(409).json({
        success: false,
        error: { code: 'DECISION_CONFLICT', message: error.message },
      });
    }

    next(error);
  }
};

module.exports = {
  getPendingDecisions,
  getDecisionById,
  handleDecisionAction,
};
