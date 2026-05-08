-- Drop redundant decision_type column (replaced by recommended_action which already captures the action intent)
ALTER TABLE "decisions" DROP COLUMN "decision_type";

-- Drop the now-unused DecisionType enum
DROP TYPE "DecisionType";
