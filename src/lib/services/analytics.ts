import "server-only"

import { DateTime } from "luxon"

import { prisma } from "@/lib/prisma"
import {
  availablePeriods,
  chartMonths,
  monthAxisLabel,
  monthsInPeriod,
  periodLabel,
  resolveSelected,
  type PeriodMode,
} from "@/lib/periods"

// Dashboard aggregation. Reads the precomputed MonthlySummary / CategorySummary
// rollups (materialized on write in services/summaries.ts) rather than scanning
// the Transaction table on every load. Only the point-in-time bits — account
// balances and the single largest expense — hit Transaction directly.
//
// spend/income/net exclude transfers and CC bill payments by construction
// (those legs carry excludeFromSpend, applied when the rollup is built).

export type AccountSummary = {
  id: string
  name: string
  bank: string
  type: "SAVINGS" | "CREDIT_CARD"
  accountNumber: string
  balance: string | null
  due: string | null
  creditLimit: string | null
  lastActivity: string | null
  transactionCount: number
}

export type CategorySlice = {
  categoryId: string | null
  name: string
  color: string | null
  icon: string | null
  amount: number
  share: number
}

export type DashboardData = {
  hasData: boolean
  mode: PeriodMode
  months: string[]
  years: string[]
  financialYears: string[]
  selected: string | null
  label: string
  kpis: {
    income: string
    spend: string
    net: string
    /** Net as a fraction of income (0–1), or null when there's no income. */
    savingsRate: number | null
    transactionCount: number
    /** Mean spend per active month in the period (year/FY context). */
    avgMonthlySpend: string
    largestExpense: { amount: string; label: string } | null
  }
  monthlySeries: { month: string; label: string; income: number; spend: number }[]
  categoryBreakdown: CategorySlice[]
  accounts: AccountSummary[]
  latestPayout: { periodMonth: string; netPay: string; employer: string; matched: boolean } | null
}

/** Just id + name for filter dropdowns — one query, no per-account balance work. */
export async function listAccountOptions(
  userId: string
): Promise<{ id: string; name: string }[]> {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  })
}

export async function getAccountSummaries(userId: string): Promise<AccountSummary[]> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { transactions: true } } },
  })

  return Promise.all(
    accounts.map(async (account) => {
      const latest = await prisma.transaction.findFirst({
        where: { accountId: account.id },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: { date: true, balanceAfter: true },
      })
      let due: string | null = null
      if (account.type === "CREDIT_CARD") {
        const latestImport = await prisma.statementImport.findFirst({
          where: { accountId: account.id, status: "COMMITTED" },
          orderBy: [{ periodEnd: "desc" }, { committedAt: "desc" }],
          select: { statementMeta: true },
        })
        const meta = latestImport?.statementMeta as Record<string, string> | null
        due = meta?.totalDue ?? null
      }
      return {
        id: account.id,
        name: account.name,
        bank: account.bank,
        type: account.type,
        accountNumber: account.accountNumber,
        balance: account.type === "SAVINGS" ? (latest?.balanceAfter?.toFixed(2) ?? null) : null,
        due,
        creditLimit: account.creditLimit?.toFixed(2) ?? null,
        lastActivity: latest?.date.toISOString().slice(0, 10) ?? null,
        transactionCount: account._count.transactions,
      }
    })
  )
}

type MonthlyRow = { month: string; income: number; spend: number; net: number; txnCount: number }

export async function getDashboardData(
  userId: string,
  mode: PeriodMode = "MONTH",
  requestedPeriod?: string
): Promise<DashboardData> {
  const summaries = await prisma.monthlySummary.findMany({
    where: { userId },
    orderBy: { month: "desc" },
  })
  const byMonth = new Map<string, MonthlyRow>(
    summaries.map((s) => [
      s.month,
      {
        month: s.month,
        income: Number(s.income),
        spend: Number(s.spend),
        net: Number(s.net),
        txnCount: s.txnCount,
      },
    ])
  )

  const available = availablePeriods(summaries.map((s) => s.month))
  const selected = resolveSelected(mode, requestedPeriod, available)

  const accounts = await getAccountSummaries(userId)

  if (!selected) {
    return {
      hasData: false,
      mode,
      ...available,
      selected: null,
      label: "",
      kpis: {
        income: "0.00",
        spend: "0.00",
        net: "0.00",
        savingsRate: null,
        transactionCount: 0,
        avgMonthlySpend: "0.00",
        largestExpense: null,
      },
      monthlySeries: [],
      categoryBreakdown: [],
      accounts,
      latestPayout: null,
    }
  }

  const periodMonths = monthsInPeriod(mode, selected)

  // KPIs — sum the rollup rows in range.
  let income = 0
  let spend = 0
  let txnCount = 0
  let activeMonths = 0
  for (const month of periodMonths) {
    const row = byMonth.get(month)
    if (!row) continue
    income += row.income
    spend += row.spend
    txnCount += row.txnCount
    if (row.income || row.spend) activeMonths += 1
  }
  const net = income - spend

  // Trend — the period's months (or trailing 6 for MONTH mode), zero-filled.
  const monthlySeries = chartMonths(mode, selected).map((month) => {
    const row = byMonth.get(month)
    return {
      month,
      label: monthAxisLabel(month),
      income: Math.round(row?.income ?? 0),
      spend: Math.round(row?.spend ?? 0),
    }
  })

  // Category breakdown — sum the DEBIT category rollups in range.
  const catRows = await prisma.categorySummary.findMany({
    where: { userId, month: { in: periodMonths }, direction: "DEBIT" },
  })
  const catTotals = new Map<string | null, number>()
  for (const row of catRows) {
    const key = row.topCategoryId
    catTotals.set(key, (catTotals.get(key) ?? 0) + Number(row.total))
  }
  const topCategoryIds = [...catTotals.keys()].filter((id): id is string => Boolean(id))
  const categories = topCategoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: topCategoryIds } },
        select: { id: true, name: true, color: true, icon: true },
      })
    : []
  const catMeta = new Map(categories.map((c) => [c.id, c]))
  const categoryBreakdown: CategorySlice[] = [...catTotals.entries()]
    .map(([id, amount]) => {
      const meta = id ? catMeta.get(id) : undefined
      return {
        categoryId: id,
        name: meta?.name ?? "Uncategorized",
        color: meta?.color ?? null,
        icon: meta?.icon ?? null,
        amount: Math.round(amount * 100) / 100,
        share: spend > 0 ? amount / spend : 0,
      }
    })
    .sort((a, b) => b.amount - a.amount)

  // Largest single expense in the period (point query — not worth rolling up).
  const rangeStart = DateTime.fromFormat(periodMonths[0], "yyyy-MM", { zone: "utc" }).toJSDate()
  const rangeEnd = DateTime.fromFormat(periodMonths[periodMonths.length - 1], "yyyy-MM", {
    zone: "utc",
  })
    .plus({ months: 1 })
    .toJSDate()
  const largest = await prisma.transaction.findFirst({
    where: {
      userId,
      direction: "DEBIT",
      excludeFromSpend: false,
      date: { gte: rangeStart, lt: rangeEnd },
      OR: [{ categoryId: null }, { category: { kind: { not: "TRANSFER" } } }],
    },
    orderBy: { amount: "desc" },
    select: { amount: true, narration: true, counterparty: true },
  })

  const latestPayoutRow = await prisma.payslip.findFirst({
    where: { userId },
    orderBy: { periodMonth: "desc" },
    select: { periodMonth: true, netPay: true, employer: true, matchedTransactionId: true },
  })

  return {
    hasData: true,
    mode,
    ...available,
    selected,
    label: periodLabel(mode, selected),
    kpis: {
      income: income.toFixed(2),
      spend: spend.toFixed(2),
      net: net.toFixed(2),
      savingsRate: income > 0 ? net / income : null,
      transactionCount: txnCount,
      avgMonthlySpend: (activeMonths > 0 ? spend / activeMonths : 0).toFixed(2),
      largestExpense: largest
        ? {
            amount: Number(largest.amount).toFixed(2),
            label: largest.counterparty ?? largest.narration.slice(0, 40),
          }
        : null,
    },
    monthlySeries,
    categoryBreakdown,
    accounts,
    latestPayout: latestPayoutRow
      ? {
          periodMonth: latestPayoutRow.periodMonth.toISOString().slice(0, 10),
          netPay: latestPayoutRow.netPay.toFixed(2),
          employer: latestPayoutRow.employer,
          matched: Boolean(latestPayoutRow.matchedTransactionId),
        }
      : null,
  }
}
