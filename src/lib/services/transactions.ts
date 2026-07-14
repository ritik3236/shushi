import "server-only"

import type { Prisma } from "@prisma/client"
import { DateTime } from "luxon"

import { prisma } from "@/lib/prisma"
import { invalidateCategoryData } from "@/lib/services/category-cache"
import { invalidateFilterOptions } from "@/lib/services/filter-options-cache"
import { monthKey, rebuildSummaries } from "@/lib/services/summaries"
import { NotFoundError, ValidationError } from "@/lib/errors"

export const TRANSACTIONS_PAGE_SIZE = 50

export type TransactionFilters = {
  /** "2026-06" */
  month?: string
  /** Inclusive day-range bounds ("2026-06-01"). Take precedence over `month`. */
  from?: string
  to?: string
  accountId?: string
  /** Matches the category itself or any of its children. */
  categoryId?: string
  direction?: "DEBIT" | "CREDIT"
  q?: string
  /** Filter to rows carrying this tag. */
  tag?: string
  /** Filter to rows assigned to this person. */
  person?: string
  onlyUncategorized?: boolean
  hideTransfers?: boolean
  page?: number
}

export type TransactionRow = {
  id: string
  date: string
  narration: string
  counterparty: string | null
  channel: string | null
  refNo: string | null
  direction: "DEBIT" | "CREDIT"
  amount: string
  balanceAfter: string | null
  account: { id: string; name: string; bank: string; type: "SAVINGS" | "CREDIT_CARD" }
  category: {
    id: string
    name: string
    color: string | null
    icon: string | null
    kind: "EXPENSE" | "INCOME" | "TRANSFER"
    parentName: string | null
  } | null
  transferKind: "SELF_TRANSFER" | "CC_PAYMENT" | null
  transferGroupId: string | null
  excludeFromSpend: boolean
  tags: string[]
  person: { id: string; name: string } | null
  notes: string | null
}

export type TransactionPage = {
  rows: TransactionRow[]
  total: number
  page: number
  pageCount: number
  pageSize: number
}

function monthRange(month: string): { gte: Date; lt: Date } | null {
  const start = DateTime.fromFormat(month, "yyyy-MM", { zone: "utc" })
  if (!start.isValid) return null
  return { gte: start.toJSDate(), lt: start.plus({ months: 1 }).toJSDate() }
}

/** Inclusive [from, to] day bounds → a Prisma date filter (either end optional). */
function dayRange(from?: string, to?: string): { gte?: Date; lte?: Date } | null {
  const range: { gte?: Date; lte?: Date } = {}
  if (from) {
    const start = DateTime.fromFormat(from, "yyyy-MM-dd", { zone: "utc" })
    if (start.isValid) range.gte = start.startOf("day").toJSDate()
  }
  if (to) {
    const end = DateTime.fromFormat(to, "yyyy-MM-dd", { zone: "utc" })
    if (end.isValid) range.lte = end.endOf("day").toJSDate()
  }
  return range.gte || range.lte ? range : null
}

export async function listTransactions(
  userId: string,
  filters: TransactionFilters
): Promise<TransactionPage> {
  const where: Prisma.TransactionWhereInput = { userId }

  // A day-range (from/to) wins over month — the UI keeps them mutually exclusive.
  const range = dayRange(filters.from, filters.to)
  if (range) {
    where.date = range
  } else if (filters.month) {
    const monthBounds = monthRange(filters.month)
    if (monthBounds) where.date = monthBounds
  }
  if (filters.accountId) where.accountId = filters.accountId
  if (filters.direction) where.direction = filters.direction
  if (filters.onlyUncategorized) where.categoryId = null
  if (filters.hideTransfers) where.transferGroupId = null
  if (filters.tag) where.tags = { has: filters.tag }
  if (filters.person) where.personId = filters.person
  if (filters.categoryId) {
    const children = await prisma.category.findMany({
      where: { parentId: filters.categoryId },
      select: { id: true },
    })
    where.categoryId = { in: [filters.categoryId, ...children.map((c) => c.id)] }
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim()
    where.OR = [
      { narration: { contains: q, mode: "insensitive" } },
      { counterparty: { contains: q, mode: "insensitive" } },
    ]
  }

  const page = Math.max(1, filters.page ?? 1)
  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * TRANSACTIONS_PAGE_SIZE,
      take: TRANSACTIONS_PAGE_SIZE,
      include: {
        account: { select: { id: true, name: true, bank: true, type: true } },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            kind: true,
            parent: { select: { name: true } },
          },
        },
        person: { select: { id: true, name: true } },
      },
    }),
  ])

  return {
    rows: rows.map((row) => ({
      id: row.id,
      date: row.date.toISOString().slice(0, 10),
      narration: row.narration,
      counterparty: row.counterparty,
      channel: row.channel,
      refNo: row.refNo,
      direction: row.direction,
      amount: row.amount.toFixed(2),
      balanceAfter: row.balanceAfter?.toFixed(2) ?? null,
      account: row.account,
      category: row.category
        ? {
            id: row.category.id,
            name: row.category.name,
            color: row.category.color,
            icon: row.category.icon,
            kind: row.category.kind,
            parentName: row.category.parent?.name ?? null,
          }
        : null,
      transferKind: row.transferKind,
      transferGroupId: row.transferGroupId,
      excludeFromSpend: row.excludeFromSpend,
      tags: row.tags,
      person: row.person,
      notes: row.notes,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / TRANSACTIONS_PAGE_SIZE)),
    pageSize: TRANSACTIONS_PAGE_SIZE,
  }
}

/** Set a transaction's tags. Lowercased, trimmed, deduped, max 8. */
export async function setTransactionTags(
  userId: string,
  transactionId: string,
  tags: string[]
): Promise<void> {
  const clean = [
    ...new Set(
      tags
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 24)
    ),
  ].slice(0, 8)
  const result = await prisma.transaction.updateMany({
    where: { id: transactionId, userId },
    data: { tags: clean },
  })
  if (!result.count) throw new NotFoundError("Transaction not found.")
  invalidateFilterOptions(userId)
}

/** Distinct tags this user has used, with counts (for autocomplete + filter). */
export async function listAllTags(userId: string): Promise<{ tag: string; count: number }[]> {
  const rows = await prisma.$queryRaw<{ tag: string; count: bigint }[]>`
    SELECT unnest(tags) AS tag, COUNT(*) AS count
    FROM "Transaction"
    WHERE "userId" = ${userId}::uuid AND array_length(tags, 1) > 0
    GROUP BY tag
    ORDER BY count DESC, tag ASC
  `
  return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }))
}

/** Months that actually have transactions, newest first ("2026-06"). */
export async function listTransactionMonths(userId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ month: string }[]>`
    SELECT DISTINCT to_char(date, 'YYYY-MM') AS month
    FROM "Transaction"
    WHERE "userId" = ${userId}::uuid
    ORDER BY month DESC
  `
  return rows.map((row) => row.month)
}

export async function setTransactionCategory(
  userId: string,
  transactionId: string,
  categoryId: string | null
): Promise<void> {
  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, OR: [{ userId }, { userId: null }] },
      select: { id: true },
    })
    if (!category) throw new NotFoundError("Category not found.")
  }
  const txn = await prisma.transaction.findFirst({
    where: { id: transactionId, userId },
    select: { date: true },
  })
  if (!txn) throw new NotFoundError("Transaction not found.")
  await prisma.transaction.update({ where: { id: transactionId }, data: { categoryId } })
  await rebuildSummaries(userId, [monthKey(txn.date)])
}

export async function setTransactionExcluded(
  userId: string,
  transactionId: string,
  excludeFromSpend: boolean
): Promise<void> {
  const txn = await prisma.transaction.findFirst({
    where: { id: transactionId, userId },
    select: { date: true },
  })
  if (!txn) throw new NotFoundError("Transaction not found.")
  await prisma.transaction.update({ where: { id: transactionId }, data: { excludeFromSpend } })
  await rebuildSummaries(userId, [monthKey(txn.date)])
}

/**
 * "Always categorize like this": create a rule from a transaction and apply it
 * to every existing uncategorized transaction that matches.
 */
export async function createRuleFromTransaction(input: {
  userId: string
  pattern: string
  field: "NARRATION" | "COUNTERPARTY"
  categoryId: string
  applyToExisting: boolean
}): Promise<{ applied: number }> {
  const pattern = input.pattern.trim()
  if (pattern.length < 3) {
    throw new ValidationError("Rule pattern must be at least 3 characters.")
  }

  await prisma.categoryRule.create({
    data: {
      userId: input.userId,
      pattern,
      field: input.field,
      match: "CONTAINS",
      categoryId: input.categoryId,
      priority: 50,
    },
  })
  invalidateCategoryData(input.userId) // the rules list changed

  if (!input.applyToExisting) return { applied: 0 }

  const result = await prisma.transaction.updateMany({
    where: {
      userId: input.userId,
      categoryId: null,
      ...(input.field === "NARRATION"
        ? { narration: { contains: pattern, mode: "insensitive" } }
        : { counterparty: { contains: pattern, mode: "insensitive" } }),
    },
    data: { categoryId: input.categoryId },
  })
  // The rule can touch transactions in any month → rebuild the whole rollup.
  if (result.count > 0) await rebuildSummaries(input.userId)
  return { applied: result.count }
}
