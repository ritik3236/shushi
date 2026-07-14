-- CreateTable
CREATE TABLE "MonthlySummary" (
    "userId" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "income" DECIMAL(14,2) NOT NULL,
    "spend" DECIMAL(14,2) NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "txnCount" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MonthlySummary_pkey" PRIMARY KEY ("userId","month")
);

-- CreateTable
CREATE TABLE "CategorySummary" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "topCategoryId" TEXT,
    "direction" "TxDirection" NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "CategorySummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategorySummary_userId_month_idx" ON "CategorySummary"("userId", "month");

-- CreateIndex
CREATE INDEX "CategorySummary_userId_topCategoryId_idx" ON "CategorySummary"("userId", "topCategoryId");

-- AddForeignKey
ALTER TABLE "MonthlySummary" ADD CONSTRAINT "MonthlySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategorySummary" ADD CONSTRAINT "CategorySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
