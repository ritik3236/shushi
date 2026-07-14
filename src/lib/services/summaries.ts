import "server-only"

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

// Materialized rollups. The dashboard reads MonthlySummary / CategorySummary
// instead of aggregating the whole Transaction table on every load; these are
// rebuilt here whenever transactions change. Month ('YYYY-MM') is the base
// grain — year and financial-year views just sum the relevant month rows.
//
// Definitions mirror the analytics rules exactly: excludeFromSpend rows,
// TRANSFER-kind categories, and person-assigned rows (khata — lending, not
// spend/income) are left out; uncategorized rows are counted. Enum columns are
// compared as ::text so the multiSchema enum type never has to resolve through
// search_path.

/** 'YYYY-MM' for a JS Date (UTC — transaction dates are stored as DATE). */
export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}

/**
 * Recompute the rollups for a user. Pass `months` to rebuild only those months
 * (a single edited transaction), or omit to rebuild everything (after an import,
 * where transfer/payslip linking can touch arbitrary months). Delete-then-insert
 * so months that dropped to zero counted rows correctly lose their summary row.
 */
export async function rebuildSummaries(userId: string, months?: string[]): Promise<void> {
  const scoped = months && months.length > 0
  const monthArray = scoped ? months! : []

  const monthlyWhere = scoped
    ? Prisma.sql`"userId" = ${userId}::uuid AND month = ANY(${monthArray}::text[])`
    : Prisma.sql`"userId" = ${userId}::uuid`

  const txMonthFilter = scoped
    ? Prisma.sql`AND to_char(t.date, 'YYYY-MM') = ANY(${monthArray}::text[])`
    : Prisma.empty

  const countedFilter = Prisma.sql`
    t."userId" = ${userId}::uuid
    AND t."excludeFromSpend" = false
    AND t."personId" IS NULL
    AND (c.kind IS NULL OR c.kind::text <> 'TRANSFER')
    ${txMonthFilter}
  `

  await prisma.$transaction([
    prisma.$executeRaw(Prisma.sql`DELETE FROM "MonthlySummary" WHERE ${monthlyWhere}`),
    prisma.$executeRaw(Prisma.sql`DELETE FROM "CategorySummary" WHERE ${monthlyWhere}`),
    prisma.$executeRaw(Prisma.sql`
      INSERT INTO "MonthlySummary" ("userId", month, income, spend, net, "txnCount", "updatedAt")
      SELECT
        t."userId",
        to_char(t.date, 'YYYY-MM') AS month,
        COALESCE(SUM(t.amount) FILTER (WHERE t.direction::text = 'CREDIT'), 0) AS income,
        COALESCE(SUM(t.amount) FILTER (WHERE t.direction::text = 'DEBIT'), 0) AS spend,
        COALESCE(SUM(t.amount) FILTER (WHERE t.direction::text = 'CREDIT'), 0)
          - COALESCE(SUM(t.amount) FILTER (WHERE t.direction::text = 'DEBIT'), 0) AS net,
        COUNT(*) AS "txnCount",
        now()
      FROM "Transaction" t
      LEFT JOIN "Category" c ON t."categoryId" = c.id
      WHERE ${countedFilter}
      GROUP BY t."userId", to_char(t.date, 'YYYY-MM')
    `),
    prisma.$executeRaw(Prisma.sql`
      INSERT INTO "CategorySummary" (id, "userId", month, "topCategoryId", direction, total, count)
      SELECT
        gen_random_uuid()::text,
        t."userId",
        to_char(t.date, 'YYYY-MM') AS month,
        COALESCE(parent.id, c.id) AS "topCategoryId",
        t.direction,
        SUM(t.amount) AS total,
        COUNT(*) AS count
      FROM "Transaction" t
      LEFT JOIN "Category" c ON t."categoryId" = c.id
      LEFT JOIN "Category" parent ON c."parentId" = parent.id
      WHERE ${countedFilter}
      GROUP BY t."userId", to_char(t.date, 'YYYY-MM'), COALESCE(parent.id, c.id), t.direction
    `),
  ])
}
