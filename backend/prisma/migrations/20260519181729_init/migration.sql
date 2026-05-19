-- CreateIndex
CREATE INDEX "predictions_bearing_id_file_idx_idx" ON "predictions"("bearing_id", "file_idx" DESC);

-- CreateIndex
CREATE INDEX "predictions_hybrid_score_idx" ON "predictions"("hybrid_score" DESC);
