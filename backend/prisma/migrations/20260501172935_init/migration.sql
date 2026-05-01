-- CreateEnum
CREATE TYPE "BearingStatus" AS ENUM ('NORMAL', 'INSPECT', 'NEGOTIATE', 'MAINTAIN', 'STOP', 'OFFLINE');

-- CreateEnum
CREATE TYPE "FaultType" AS ENUM ('INNER_RACE', 'OUTER_RACE', 'BALL', 'CAGE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('PENDING', 'RESOLVED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CONTINUE', 'INSPECT', 'MAINTAIN', 'STOP');

-- CreateEnum
CREATE TYPE "OperatorAction" AS ENUM ('APPROVE', 'OVERRIDE', 'REJECT', 'ACKNOWLEDGE');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TriggerSource" AS ENUM ('ANOMALY_TRIGGER', 'SAFETY_VETO', 'MANUAL_REQUEST', 'SCHEDULED_CHECK');

-- CreateEnum
CREATE TYPE "AgentMessageType" AS ENUM ('PROPOSE', 'CRITIQUE', 'VOTE', 'SUMMARY');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('VIEWER', 'OPERATOR', 'ENGINEER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('MAINTENANCE', 'INSPECTION', 'REPLACEMENT', 'IGNORE');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('DECISION', 'CONFIG', 'AUTH', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConfigGroup" AS ENUM ('THRESHOLDS', 'AGENTS', 'SYNTHETIC_CONTEXT');

-- CreateEnum
CREATE TYPE "ActionSource" AS ENUM ('WEB_UI', 'API', 'SYSTEM');

-- CreateTable
CREATE TABLE "bearings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bearing_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "dataset_source" TEXT NOT NULL,
    "condition_label" TEXT NOT NULL,
    "rpm" INTEGER,
    "load_kn" DOUBLE PRECISION,
    "installation_date" TIMESTAMPTZ(6),
    "status" "BearingStatus" NOT NULL DEFAULT 'NORMAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bearings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bearing_id" UUID NOT NULL,
    "file_idx" INTEGER NOT NULL,
    "sample_ts" TIMESTAMPTZ(6) NOT NULL,
    "rul_hours" DOUBLE PRECISION NOT NULL,
    "rul_lower_hours" DOUBLE PRECISION,
    "rul_upper_hours" DOUBLE PRECISION,
    "p_fail" DOUBLE PRECISION NOT NULL,
    "health_score" DOUBLE PRECISION NOT NULL,
    "uncertainty_score" DOUBLE PRECISION,
    "fault_type" "FaultType",
    "fault_confidence" DOUBLE PRECISION,
    "stat_score" DOUBLE PRECISION,
    "rul_drop_score" DOUBLE PRECISION,
    "hybrid_score" DOUBLE PRECISION,
    "threshold_tau" DOUBLE PRECISION,
    "model_version" TEXT NOT NULL,
    "pipeline_run_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bearing_id" UUID NOT NULL,
    "prediction_id" UUID NOT NULL,
    "snapshot_ts" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL,
    "trigger_source" "TriggerSource" NOT NULL,
    "feature_vector_ref" TEXT,
    "signal_window_ref" TEXT,
    "summary_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "snapshot_id" UUID NOT NULL,
    "decision_type" "DecisionType" NOT NULL,
    "recommended_action" "ActionType" NOT NULL,
    "recommended_confidence" DOUBLE PRECISION,
    "decision_status" "DecisionStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "safety_veto" BOOLEAN NOT NULL DEFAULT false,
    "reason_summary" TEXT,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "decision_id" UUID NOT NULL,
    "action" "OperatorAction" NOT NULL,
    "final_action" "ActionType" NOT NULL,
    "override_reason" TEXT,
    "actor_user_id" UUID NOT NULL,
    "actor_role" TEXT NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "ActionSource" NOT NULL,

    CONSTRAINT "decision_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "override_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "decision_id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "ai_recommended_action" "ActionType" NOT NULL,
    "human_selected_action" "ActionType" NOT NULL,
    "override_reason" TEXT,
    "confidence_gap" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "override_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_transcripts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "snapshot_id" UUID NOT NULL,
    "round_no" INTEGER NOT NULL,
    "agent_name" TEXT NOT NULL,
    "message_type" "AgentMessageType" NOT NULL,
    "action_candidate" "ActionType",
    "confidence" DOUBLE PRECISION,
    "reasoning_text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "config_group" "ConfigGroup" NOT NULL,
    "config_key" TEXT NOT NULL,
    "config_value_json" JSONB NOT NULL,
    "version_no" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runtime_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" TEXT NOT NULL,
    "full_name" TEXT,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" UUID,
    "payload_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bearings_bearing_id_key" ON "bearings"("bearing_id");

-- CreateIndex
CREATE INDEX "predictions_bearing_id_sample_ts_idx" ON "predictions"("bearing_id", "sample_ts" DESC);

-- CreateIndex
CREATE INDEX "predictions_created_at_idx" ON "predictions"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "predictions_bearing_id_file_idx_model_version_key" ON "predictions"("bearing_id", "file_idx", "model_version");

-- CreateIndex
CREATE INDEX "snapshots_bearing_id_snapshot_ts_idx" ON "snapshots"("bearing_id", "snapshot_ts" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "decisions_snapshot_id_key" ON "decisions"("snapshot_id");

-- CreateIndex
CREATE INDEX "decisions_decision_status_idx" ON "decisions"("decision_status");

-- CreateIndex
CREATE INDEX "agent_transcripts_snapshot_id_round_no_created_at_idx" ON "agent_transcripts"("snapshot_id", "round_no", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "runtime_configs_config_key_key" ON "runtime_configs"("config_key");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_bearing_id_fkey" FOREIGN KEY ("bearing_id") REFERENCES "bearings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_bearing_id_fkey" FOREIGN KEY ("bearing_id") REFERENCES "bearings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_prediction_id_fkey" FOREIGN KEY ("prediction_id") REFERENCES "predictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_actions" ADD CONSTRAINT "decision_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_actions" ADD CONSTRAINT "decision_actions_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "override_preferences" ADD CONSTRAINT "override_preferences_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_transcripts" ADD CONSTRAINT "agent_transcripts_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_configs" ADD CONSTRAINT "runtime_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
