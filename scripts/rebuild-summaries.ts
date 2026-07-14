import "dotenv/config"

import { prisma } from "@/lib/prisma"
import { rebuildSummaries } from "@/lib/services/summaries"
import { getDashboardData } from "@/lib/services/analytics"

// Backfill/rebuild the dashboard rollups for a user, then cross-check the
// materialized totals against a live aggregation so we know the rollup matches
// the source of truth. Usage: ... scripts/rebuild-summaries.ts <email>

async function main() {
  const email = process.argv[2]
  if (!email) throw new Error("Usage: rebuild-summaries.ts <email>")
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error(`No user ${email}`)

  console.time("rebuild")
  await rebuildSummaries(user.id)
  console.timeEnd("rebuild")

  const summaryRows = await prisma.monthlySummary.count({ where: { userId: user.id } })
  console.log(`MonthlySummary rows: ${summaryRows}`)

  // Live cross-check: sum all counted transactions directly and compare to the
  // sum of every monthly rollup row.
  const live = await prisma.$queryRaw<{ income: string; spend: string; cnt: bigint }[]>`
    SELECT
      COALESCE(SUM(t.amount) FILTER (WHERE t.direction::text = 'CREDIT'), 0)::text AS income,
      COALESCE(SUM(t.amount) FILTER (WHERE t.direction::text = 'DEBIT'), 0)::text AS spend,
      COUNT(*) AS cnt
    FROM "Transaction" t
    LEFT JOIN "Category" c ON t."categoryId" = c.id
    WHERE t."userId" = ${user.id}::uuid
      AND t."excludeFromSpend" = false
      AND (c.kind IS NULL OR c.kind::text <> 'TRANSFER')
  `
  const roll = await prisma.monthlySummary.aggregate({
    where: { userId: user.id },
    _sum: { income: true, spend: true, txnCount: true },
  })
  const liveIncome = Number(live[0].income)
  const liveSpend = Number(live[0].spend)
  const rollIncome = Number(roll._sum.income ?? 0)
  const rollSpend = Number(roll._sum.spend ?? 0)
  const ok =
    Math.abs(liveIncome - rollIncome) < 0.01 &&
    Math.abs(liveSpend - rollSpend) < 0.01 &&
    Number(live[0].cnt) === (roll._sum.txnCount ?? 0)
  console.log(`CROSS-CHECK ${ok ? "OK" : "MISMATCH"}:`)
  console.log(`  live   income=${liveIncome.toFixed(2)} spend=${liveSpend.toFixed(2)} cnt=${live[0].cnt}`)
  console.log(`  rollup income=${rollIncome.toFixed(2)} spend=${rollSpend.toFixed(2)} cnt=${roll._sum.txnCount}`)

  for (const mode of ["MONTH", "YEAR", "FY"] as const) {
    const d = await getDashboardData(user.id, mode)
    console.log(
      `${mode} → ${d.label}: income ₹${d.kpis.income} spend ₹${d.kpis.spend} net ₹${d.kpis.net} ` +
        `savings ${d.kpis.savingsRate === null ? "—" : Math.round(d.kpis.savingsRate * 100) + "%"} ` +
        `| top: ${d.categoryBreakdown.slice(0, 3).map((c) => c.name).join(", ")}`
    )
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
