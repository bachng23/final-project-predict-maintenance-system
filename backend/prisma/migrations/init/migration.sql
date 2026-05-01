-- CreateEnums
CREATE TYPE "BearingStatus" AS ENUM ('NORMAL', 'INSPECT', 'NEGOTIATE', 'MAINTAIN', 'STOP', 'OFFLINE');
CREATE TYPE "FaultType" AS ENUM ('INNER_RACE', 'OUTER_RACE', 'BALL', 'CAGE', 'UNKNOWN');
CREATE TYPE "DecisionStatus" AS ENUM ('PENDING', 'RESOLVED', 'ACKNOWLEDGED');
CREATE TYPE "DecisionActionType" AS ENUM ('CONTINUE', 'INSPECT', 'MAINTAIN', 'STOP');
CREATE TYPE "OperatorAction" AS ENUM ('APPROVE', 'OVERRIDE', 'REJECT', 'ACKNOWLEDGE');
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "TriggerSource" AS ENUM ('ANOMALY_TRIGGER', 'SAFETY_VETO', 'MANUAL_REQUEST', 'SCHEDULED_CHECK');
CREATE TYPE "AgentMessageType" AS ENUM ('PROPOSE', 'CRITIQUE', 'VOTE', 'SUMMARY');
CREATE TYPE "ConfigGroup" AS ENUM ('THRESHOLDS', 'AGENTS', 'SYNTHETIC_CONTEXT');
CREATE TYPE "EntityType" AS ENUM ('DECISION', 'CONFIG', 'AUTH', 'SYSTEM');
CREATE TYPE "UserRole" AS ENUM ('VIEWER', 'OPERATOR', 'ENGINEER', 'ADMIN');
CREATE TYPE "ActionSource" AS ENUM ('WEB_UI', 'API', 'SYSTEM');

-- CreateTable bearings
CREATE TABLE "bearings" (
    "id" UUID NOT NULL,
    "bearing_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "dataset_source" TEXT NOT NULL,
    "condition_label" TEXT NOT NULL,
    "rpm" INTEGER,
    "load_kn" DECIMAL,
    "installation_date" TIMESTAMP(3),
    "status" "BearingStatus" NOT NULL,
    "active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bearings_pkey" PRIMARY KEY ("id")
);

-- CreateTable predictions
CREATE TABLE "predictions" (
    "id" UUID NOT NULL,
    "bearing_id" UUID NOT NULL,
    "file_idx" INTEGER NOT NULL,
    "sample_ts" TIMESTAMP(3) NOT NULL,
    "rul_hours" DECIMAL NOT NULL,
    "rul_lower_hours" DECIMAL,
    "rul_upper_hours" DECIMAL,
    "p_fail" DECIMAL NOT NULL,
    "health_score" DECIMAL NOT NULL,
    "uncertainty_score" DECIMAL,
    "fault_type" TEXT,
    "fault_confidence" DECIMAL,
    "stat_score" DECIMAL,
    "rul_drop_score" DECIMAL,
    "hybrid_score" DECIMAL,
    "threshold_tau" DECIMAL,
    "model_version" TEXT NOT NULL,
    "pipeline_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable snapshots
CREATE TABLE "snapshots" (
    "id" UUID NOT NULL,
    "bearing_id" UUID NOT NULL,
    "prediction_id" UUID NOT NULL,
    "snapshot_ts" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "trigger_source" "TriggerSource" NOT NULL,
    "feature_vector_ref" TEXT,
    "signal_window_ref" TEXT,
    "summary_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable decisions
CREATE TABLE "decisions" (
    "id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "decision_type" TEXT NOT NULL,
    "recommended_action" TEXT NOT NULL,
    "recommended_confidence" DECIMAL,
    "decision_status" "DecisionStatus" NOT NULL,
    "priority" "PriorityLevel" NOT NULL,
    "safety_veto" BOOLEAN NOT NULL,
    "reason_summary" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable decision_actions
CREATE TABLE "decision_actions" (
    "id" UUID NOT NULL,
    "decision_id" UUID NOT NULL,
    "action" "OperatorAction" NOT NULL,
    "final_action" TEXT NOT NULL,
    "override_reason" TEXT,
    "actor_user_id" UUID NOT NULL,
    "actor_role" "UserRole" NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "source" "ActionSource" NOT NULL,

    CONSTRAINT "decision_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable override_preferences
CREATE TABLE "override_preferences" (
    "id" UUID NOT NULL,
    "decision_id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "ai_recommended_action" TEXT NOT NULL,
    "human_selected_action" TEXT NOT NULL,
    "override_reason" TEXT,
    "confidence_gap" DECIMAL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "override_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable agent_transcripts
CREATE TABLE "agent_transcripts" (
    "id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "round_no" INTEGER NOT NULL,
    "agent_name" TEXT NOT NULL,
    "message_type" "AgentMessageType" NOT NULL,
    "action_candidate" TEXT,
    "confidence" DECIMAL,
    "reasoning_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable runtime_configs
CREATE TABLE "runtime_configs" (
    "id" UUID NOT NULL,
    "config_group" "ConfigGroup" NOT NULL,
    "config_key" TEXT NOT NULL,
    "config_value_json" JSONB NOT NULL,
    "version_no" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runtime_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable users
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "full_name" TEXT,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable audit_logs
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" UUID,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bearings_bearing_id_key" ON "bearings"("bearing_id");

-- CreateIndex
CREATE INDEX "predictions_bearing_id_file_idx_idx" ON "predictions"("bearing_id", "file_idx" DESC);
CREATE INDEX "predictions_bearing_id_sample_ts_idx" ON "predictions"("bearing_id", "sample_ts" DESC);
CREATE INDEX "predictions_created_at_idx" ON "predictions"("created_at" DESC);
CREATE UNIQUE INDEX "predictions_bearing_id_file_idx_model_version_key" ON "predictions"("bearing_id", "file_idx", "model_version");

-- CreateIndex
CREATE UNIQUE INDEX "decisions_snapshot_id_key" ON "decisions"("snapshot_id");

-- CreateIndex
CREATE UNIQUE INDEX "override_preferences_decision_id_key" ON "override_preferences"("decision_id");

-- CreateIndex
CREATE INDEX "agent_transcripts_snapshot_id_round_no_created_at_idx" ON "agent_transcripts"("snapshot_id", "round_no", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_bearing_id_fkey" FOREIGN KEY ("bearing_id") REFERENCES "bearings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_bearing_id_fkey" FOREIGN KEY ("bearing_id") REFERENCES "bearings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_prediction_id_fkey" FOREIGN KEY ("prediction_id") REFERENCES "predictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_actions" ADD CONSTRAINT "decision_actions_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "decision_actions" ADD CONSTRAINT "decision_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "override_preferences" ADD CONSTRAINT "override_preferences_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_transcripts" ADD CONSTRAINT "agent_transcripts_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_configs" ADD CONSTRAINT "runtime_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
