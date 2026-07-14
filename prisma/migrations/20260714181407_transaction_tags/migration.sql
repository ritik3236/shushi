-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Transaction_tags_idx" ON "Transaction" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "Transaction_userId_counterparty_idx" ON "Transaction"("userId", "counterparty");
