-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "color" TEXT,
ADD COLUMN     "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;
