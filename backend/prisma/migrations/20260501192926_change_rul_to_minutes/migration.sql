/*
  Warnings:

  - You are about to drop the column `rul_hours` on the `predictions` table. All the data in the column will be lost.
  - You are about to drop the column `rul_lower_hours` on the `predictions` table. All the data in the column will be lost.
  - You are about to drop the column `rul_upper_hours` on the `predictions` table. All the data in the column will be lost.
  - You are about to drop the column `uncertainty_score` on the `predictions` table. All the data in the column will be lost.
  - Added the required column `rul_minutes` to the `predictions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "predictions" DROP COLUMN "rul_hours",
DROP COLUMN "rul_lower_hours",
DROP COLUMN "rul_upper_hours",
DROP COLUMN "uncertainty_score",
ADD COLUMN     "degradation_rate" DOUBLE PRECISION,
ADD COLUMN     "ood_flag" BOOLEAN,
ADD COLUMN     "rul_lower_minutes" DOUBLE PRECISION,
ADD COLUMN     "rul_minutes" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "rul_uncertainty" DOUBLE PRECISION,
ADD COLUMN     "rul_upper_minutes" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "predictions_bearing_id_file_idx_idx" ON "predictions"("bearing_id", "file_idx" DESC);

-- CreateIndex
CREATE INDEX "predictions_hybrid_score_idx" ON "predictions"("hybrid_score" DESC);
