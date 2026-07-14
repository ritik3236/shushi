import "server-only"

import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { rebuildSummaries } from "@/lib/services/summaries"
import type { ParsedPayslip } from "@/lib/imports/types"
import { NotFoundError, ValidationError } from "@/lib/errors"

// Payslips: persistence of parsed slips + best-effort matching of the payout to
// the actual bank credit (exact net amount, within 60 days of the period month,
// preferring the account printed on the slip).

export type PayslipListRow = {
  id: string
  kind: "SALARY" | "CONTRACTOR_FEE"
  employer: string
  periodMonth: string
  grossEarnings: string
  totalDeductions: string
  netPay: string
  earnings: { label: string; amount: string }[]
  deductions: { label: string; amount: string }[]
  bankAccount: { id: string; name: string } | null
  matched: { transactionId: string; date: string; accountName: string; amount: string } | null
  fileName: string
}

export async function createPayslipFromParsed(input: {
  userId: string
  parsed: ParsedPayslip
  fileName: string
  fileHash: string
  importId: string
}): Promise<{ created: boolean; payslipId: string }> {
  const { userId, parsed, fileName, fileHash, importId } = input

  const existing = await prisma.payslip.findUnique({
    where: { userId_fileHash: { userId, fileHash } },
    select: { id: true },
  })
  if (existing) return { created: false, payslipId: existing.id }

  const bankAccount = parsed.bankAccountNumber
    ? await prisma.account.findUnique({
        where: { userId_accountNumber: { userId, accountNumber: parsed.bankAccountNumber } },
        select: { id: true },
      })
    : null

  const payslip = await prisma.payslip.create({
    data: {
      userId,
      kind: parsed.payslipKind,
      employer: parsed.employer,
      periodMonth: new Date(parsed.periodMonth),
      grossEarnings: parsed.grossEarnings,
      totalDeductions: parsed.totalDeductions,
      netPay: parsed.netPay,
      earnings: parsed.earnings as unknown as Prisma.InputJsonValue,
      deductions: parsed.deductions as unknown as Prisma.InputJsonValue,
      meta: (parsed.meta ?? {}) as Prisma.InputJsonValue,
      fileName,
      fileHash,
      importId,
      bankAccountId: bankAccount?.id ?? null,
    },
  })
  return { created: true, payslipId: payslip.id }
}

/** Categorize a matched payout credit as Salary / Contractor Fee if untouched. */
async function incomeCategoryId(kind: "SALARY" | "CONTRACTOR_FEE"): Promise<string | null> {
  const name = kind === "SALARY" ? "Salary" : "Contractor Fee"
  const category = await prisma.category.findFirst({
    where: { name, parent: { name: "Income" }, isSystem: true },
    select: { id: true },
  })
  return category?.id ?? null
}

export async function matchPayslips(userId: string): Promise<number> {
  const unmatched = await prisma.payslip.findMany({
    where: { userId, matchedTransactionId: null, netPay: { gt: 0 } },
  })
  if (!unmatched.length) return 0

  const alreadyMatched = new Set(
    (
      await prisma.payslip.findMany({
        where: { userId, matchedTransactionId: { not: null } },
        select: { matchedTransactionId: true },
      })
    ).map((p) => p.matchedTransactionId as string)
  )

  let matches = 0
  for (const payslip of unmatched) {
    const windowStart = payslip.periodMonth
    const windowEnd = new Date(payslip.periodMonth.getTime() + 60 * 86_400_000)
    const candidates = await prisma.transaction.findMany({
      where: {
        userId,
        direction: "CREDIT",
        amount: payslip.netPay,
        date: { gte: windowStart, lte: windowEnd },
        transferGroupId: null,
        id: { notIn: [...alreadyMatched] },
      },
      orderBy: { date: "asc" },
    })
    const match =
      candidates.find((c) => c.accountId === payslip.bankAccountId) ?? candidates[0]
    if (!match) continue

    const categoryId = await incomeCategoryId(payslip.kind)
    await prisma.$transaction([
      prisma.payslip.update({
        where: { id: payslip.id },
        data: { matchedTransactionId: match.id },
      }),
      ...(match.categoryId === null && categoryId
        ? [
            prisma.transaction.update({
              where: { id: match.id },
              data: { categoryId },
            }),
          ]
        : []),
    ])
    alreadyMatched.add(match.id)
    matches += 1
  }
  return matches
}

export async function listPayslips(userId: string): Promise<PayslipListRow[]> {
  const payslips = await prisma.payslip.findMany({
    where: { userId },
    orderBy: { periodMonth: "desc" },
    include: { bankAccount: { select: { id: true, name: true } } },
  })

  const matchedIds = payslips
    .map((p) => p.matchedTransactionId)
    .filter((id): id is string => Boolean(id))
  const matchedTxns = matchedIds.length
    ? await prisma.transaction.findMany({
        where: { id: { in: matchedIds } },
        select: { id: true, date: true, amount: true, account: { select: { name: true } } },
      })
    : []
  const txById = new Map(matchedTxns.map((t) => [t.id, t]))

  return payslips.map((p) => {
    const tx = p.matchedTransactionId ? txById.get(p.matchedTransactionId) : undefined
    return {
      id: p.id,
      kind: p.kind,
      employer: p.employer,
      periodMonth: p.periodMonth.toISOString().slice(0, 10),
      grossEarnings: p.grossEarnings.toFixed(2),
      totalDeductions: p.totalDeductions.toFixed(2),
      netPay: p.netPay.toFixed(2),
      earnings: p.earnings as { label: string; amount: string }[],
      deductions: p.deductions as { label: string; amount: string }[],
      bankAccount: p.bankAccount,
      matched: tx
        ? {
            transactionId: tx.id,
            date: tx.date.toISOString().slice(0, 10),
            accountName: tx.account.name,
            amount: tx.amount.toFixed(2),
          }
        : null,
      fileName: p.fileName,
    }
  })
}

// ── Manual payout linking ────────────────────────────────────────────────────
// Auto-match only looks forward from the payslip month for an exact-net credit,
// so advance-paid or net-zero slips (advance recovered) need a hand link.

export type LinkableCredit = {
  id: string
  date: string
  amount: string
  accountName: string
  narration: string
  counterparty: string | null
}

/**
 * Credit transactions this payslip could be linked to: any of the user's
 * credits not already claimed by another payslip. With no search, defaults to a
 * window around the payslip month (−2…+3 months); a search term looks across all
 * credits by narration / counterparty / amount.
 */
export async function listLinkableCredits(
  userId: string,
  payslipId: string,
  search?: string
): Promise<LinkableCredit[]> {
  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, userId },
    select: { periodMonth: true, matchedTransactionId: true },
  })
  if (!payslip) throw new NotFoundError("Payslip not found.")

  const claimed = (
    await prisma.payslip.findMany({
      where: { userId, matchedTransactionId: { not: null } },
      select: { matchedTransactionId: true },
    })
  )
    .map((p) => p.matchedTransactionId as string)
    .filter((id) => id !== payslip.matchedTransactionId)

  const where: Prisma.TransactionWhereInput = {
    userId,
    direction: "CREDIT",
    id: { notIn: claimed.length ? claimed : ["__none__"] },
  }

  const term = search?.trim()
  if (term) {
    const amountValue = Number(term.replace(/[₹,\s]/g, ""))
    where.OR = [
      { narration: { contains: term, mode: "insensitive" } },
      { counterparty: { contains: term, mode: "insensitive" } },
      ...(Number.isFinite(amountValue) && amountValue > 0 ? [{ amount: amountValue }] : []),
    ]
  } else {
    where.date = {
      gte: new Date(payslip.periodMonth.getTime() - 62 * 86_400_000),
      lte: new Date(payslip.periodMonth.getTime() + 93 * 86_400_000),
    }
  }

  const credits = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }],
    take: 50,
    select: {
      id: true,
      date: true,
      amount: true,
      narration: true,
      counterparty: true,
      account: { select: { name: true } },
    },
  })

  return credits.map((c) => ({
    id: c.id,
    date: c.date.toISOString().slice(0, 10),
    amount: c.amount.toFixed(2),
    accountName: c.account.name,
    narration: c.narration,
    counterparty: c.counterparty,
  }))
}

/** Point a payslip at a specific bank credit and tag that credit as income. */
export async function linkPayslipToTransaction(
  userId: string,
  payslipId: string,
  transactionId: string
): Promise<void> {
  const [payslip, txn, claimedBy] = await Promise.all([
    prisma.payslip.findFirst({ where: { id: payslipId, userId }, select: { id: true, kind: true } }),
    prisma.transaction.findFirst({
      where: { id: transactionId, userId, direction: "CREDIT" },
      select: { id: true, date: true, categoryId: true },
    }),
    prisma.payslip.findFirst({
      where: { userId, matchedTransactionId: transactionId, id: { not: payslipId } },
      select: { periodMonth: true },
    }),
  ])
  if (!payslip) throw new NotFoundError("Payslip not found.")
  if (!txn) throw new NotFoundError("That credit transaction was not found.")
  if (claimedBy) {
    throw new ValidationError(
      `That credit is already linked to the ${claimedBy.periodMonth.toISOString().slice(0, 7)} payslip. Unlink it there first.`
    )
  }

  const categoryId = txn.categoryId === null ? await incomeCategoryId(payslip.kind) : null

  await prisma.$transaction([
    prisma.payslip.update({
      where: { id: payslipId },
      data: { matchedTransactionId: transactionId },
    }),
    ...(categoryId
      ? [prisma.transaction.update({ where: { id: transactionId }, data: { categoryId } })]
      : []),
  ])

  if (categoryId) await rebuildSummaries(userId, [txn.date.toISOString().slice(0, 7)])
}

/** Clear a payslip's matched credit (leaves the transaction's category as-is). */
export async function unlinkPayslipMatch(userId: string, payslipId: string): Promise<void> {
  const result = await prisma.payslip.updateMany({
    where: { id: payslipId, userId },
    data: { matchedTransactionId: null },
  })
  if (!result.count) throw new NotFoundError("Payslip not found.")
}

/**
 * Delete a payslip (e.g. a duplicate). Only the payslip row is removed — the
 * matched bank credit and its category are left untouched, and the source
 * import stays in history.
 */
export async function deletePayslip(userId: string, payslipId: string): Promise<void> {
  const result = await prisma.payslip.deleteMany({ where: { id: payslipId, userId } })
  if (!result.count) throw new NotFoundError("Payslip not found.")
}
