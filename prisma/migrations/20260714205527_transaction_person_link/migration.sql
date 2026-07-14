-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "personId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_userId_personId_idx" ON "Transaction"("userId", "personId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
