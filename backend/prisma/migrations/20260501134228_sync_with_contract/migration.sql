/*
  Warnings:

  - The values [SYSTEM] on the enum `ConfigGroup` will be removed. If these variants are still used in the database, this will fail.
  - The values [BEARING,PREDICTION,SNAPSHOT,USER] on the enum `EntityType` will be removed. If these variants are still used in the database, this will fail.
  - The `action_candidate` column on the `agent_transcripts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `fault_type` column on the `predictions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `final_action` on the `decision_actions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `source` on the `decision_actions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `recommended_action` on the `decisions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `ai_recommended_action` on the `override_preferences` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `human_selected_action` on the `override_preferences` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "FaultType" AS ENUM ('INNER_RACE', 'OUTER_RACE', 'BALL', 'CAGE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CONTINUE', 'INSPECT', 'MAINTAIN', 'STOP');

-- CreateEnum
CREATE TYPE "ActionSource" AS ENUM ('WEB_UI', 'API', 'SYSTEM');

-- AlterEnum
BEGIN;
CREATE TYPE "ConfigGroup_new" AS ENUM ('THRESHOLDS', 'AGENTS', 'SYNTHETIC_CONTEXT');
ALTER TABLE "runtime_configs" ALTER COLUMN "config_group" TYPE "ConfigGroup_new" USING ("config_group"::text::"ConfigGroup_new");
ALTER TYPE "ConfigGroup" RENAME TO "ConfigGroup_old";
ALTER TYPE "ConfigGroup_new" RENAME TO "ConfigGroup";
DROP TYPE "public"."ConfigGroup_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "EntityType_new" AS ENUM ('DECISION', 'CONFIG', 'AUTH', 'SYSTEM');
ALTER TABLE "audit_logs" ALTER COLUMN "entity_type" TYPE "EntityType_new" USING ("entity_type"::text::"EntityType_new");
ALTER TYPE "EntityType" RENAME TO "EntityType_old";
ALTER TYPE "EntityType_new" RENAME TO "EntityType";
DROP TYPE "public"."EntityType_old";
COMMIT;

-- AlterTable
ALTER TABLE "agent_transcripts" DROP COLUMN "action_candidate",
ADD COLUMN     "action_candidate" "ActionType";

-- AlterTable
ALTER TABLE "decision_actions" DROP COLUMN "final_action",
ADD COLUMN     "final_action" "ActionType" NOT NULL,
DROP COLUMN "source",
ADD COLUMN     "source" "ActionSource" NOT NULL;

-- AlterTable
ALTER TABLE "decisions" DROP COLUMN "recommended_action",
ADD COLUMN     "recommended_action" "ActionType" NOT NULL;

-- AlterTable
ALTER TABLE "override_preferences" DROP COLUMN "ai_recommended_action",
ADD COLUMN     "ai_recommended_action" "ActionType" NOT NULL,
DROP COLUMN "human_selected_action",
ADD COLUMN     "human_selected_action" "ActionType" NOT NULL;

-- AlterTable
ALTER TABLE "predictions" DROP COLUMN "fault_type",
ADD COLUMN     "fault_type" "FaultType";
