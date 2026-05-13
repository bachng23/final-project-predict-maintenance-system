CREATE TABLE "features" (
    "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
    "bearing_id"    UUID        NOT NULL,
    "file_idx"      INTEGER     NOT NULL,
    "sample_ts"     TIMESTAMPTZ NOT NULL,
    "lifetime_pct"  DOUBLE PRECISION NOT NULL,
    "features_json" JSONB       NOT NULL,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "features_bearing_id_file_idx_key" UNIQUE ("bearing_id", "file_idx"),
    CONSTRAINT "features_bearing_id_fkey"
        FOREIGN KEY ("bearing_id") REFERENCES "bearings"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "features_bearing_id_sample_ts_idx"
    ON "features" ("bearing_id", "sample_ts" DESC);
