-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('SAVINGS', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "ImportFileType" AS ENUM ('AXIS_SAVINGS_CSV', 'HDFC_SAVINGS_XLS', 'AXIS_CC_XLSX', 'PAYSLIP_PDF', 'CONTRACTOR_FEE_PDF');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "TxDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "TxSource" AS ENUM ('IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "TransferKind" AS ENUM ('SELF_TRANSFER', 'CC_PAYMENT');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER');

-- CreateEnum
CREATE TYPE "RuleField" AS ENUM ('NARRATION', 'COUNTERPARTY');

-- CreateEnum
CREATE TYPE "RuleMatch" AS ENUM ('CONTAINS', 'REGEX');

-- CreateEnum
CREATE TYPE "PayslipKind" AS ENUM ('SALARY', 'CONTRACTOR_FEE');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifsc" TEXT,
    "creditLimit" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementImport" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "accountId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" "ImportFileType" NOT NULL,
    "fileHash" TEXT NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "statementMeta" JSONB,
    "payload" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMPTZ(3),

    CONSTRAINT "StatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "importId" TEXT,
    "date" DATE NOT NULL,
    "valueDate" DATE,
    "narration" TEXT NOT NULL,
    "refNo" TEXT,
    "channel" TEXT,
    "counterparty" TEXT,
    "direction" "TxDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2),
    "categoryId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "occurrence" INTEGER NOT NULL DEFAULT 1,
    "transferGroupId" TEXT,
    "transferKind" "TransferKind",
    "excludeFromSpend" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "source" "TxSource" NOT NULL DEFAULT 'IMPORT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL DEFAULT 'EXPENSE',
    "parentId" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryRule" (
    "id" TEXT NOT NULL,
    "userId" UUID,
    "pattern" TEXT NOT NULL,
    "field" "RuleField" NOT NULL DEFAULT 'NARRATION',
    "match" "RuleMatch" NOT NULL DEFAULT 'CONTAINS',
    "direction" "TxDirection",
    "categoryId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "PayslipKind" NOT NULL,
    "employer" TEXT NOT NULL,
    "periodMonth" DATE NOT NULL,
    "grossEarnings" DECIMAL(14,2) NOT NULL,
    "totalDeductions" DECIMAL(14,2) NOT NULL,
    "netPay" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "earnings" JSONB NOT NULL,
    "deductions" JSONB NOT NULL,
    "meta" JSONB,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "importId" TEXT,
    "bankAccountId" TEXT,
    "matchedTransactionId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_accountNumber_key" ON "Account"("userId", "accountNumber");

-- CreateIndex
CREATE INDEX "StatementImport_userId_fileHash_idx" ON "StatementImport"("userId", "fileHash");

-- CreateIndex
CREATE INDEX "StatementImport_userId_status_idx" ON "StatementImport"("userId", "status");

-- CreateIndex
CREATE INDEX "Transaction_userId_date_idx" ON "Transaction"("userId", "date");

-- CreateIndex
CREATE INDEX "Transaction_accountId_date_idx" ON "Transaction"("accountId", "date");

-- CreateIndex
CREATE INDEX "Transaction_userId_categoryId_idx" ON "Transaction"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "Transaction_transferGroupId_idx" ON "Transaction"("transferGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_accountId_dedupeKey_key" ON "Transaction"("accountId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_parentId_key" ON "Category"("name", "parentId");

-- CreateIndex
CREATE INDEX "CategoryRule_userId_idx" ON "CategoryRule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_matchedTransactionId_key" ON "Payslip"("matchedTransactionId");

-- CreateIndex
CREATE INDEX "Payslip_userId_periodMonth_idx" ON "Payslip"("userId", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_userId_fileHash_key" ON "Payslip"("userId", "fileHash");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementImport" ADD CONSTRAINT "StatementImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementImport" ADD CONSTRAINT "StatementImport_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "StatementImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_importId_fkey" FOREIGN KEY ("importId") REFERENCES "StatementImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
