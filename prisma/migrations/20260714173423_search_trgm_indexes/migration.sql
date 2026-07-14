-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "Transaction_narration_idx" ON "Transaction" USING GIN ("narration" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Transaction_counterparty_idx" ON "Transaction" USING GIN ("counterparty" gin_trgm_ops);
