import "server-only"

import { randomUUID } from "node:crypto"

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { rebuildSummaries } from "@/lib/services/summaries"

// Links the two legs of money moving between the user's own accounts so they
// never count as income or spend. Three passes, strongest signal first:
//   1. Same UPI/IMPS reference on a debit and a credit in different accounts —
//      the same payment seen from both banks. Definitive.
//   2. Credit-card bill payments: a CC credit tagged CC_PAYMENT matched to an
//      equal savings debit within a 4-day window.
//   3. Equal amount within 3 days across two accounts where a narration
//      mentions the user's own name (self-transfers between own banks).
// Only ever links rows that are still unlinked; conservative by design —
// a missed link is fixable in the UI, a wrong link corrupts analytics.

type Candidate = {
  id: string
  accountId: string
  accountType: "SAVINGS" | "CREDIT_CARD"
  date: Date
  direction: "DEBIT" | "CREDIT"
  amount: string
  narration: string
  counterparty: string | null
  refNo: string | null
  channel: string | null
  linked: boolean
}

const DAY_MS = 86_400_000
const daysBetween = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / DAY_MS

async function transferCategoryIds() {
  const [self, cc] = await Promise.all([
    prisma.category.findFirst({
      where: { name: "Self Transfer", parent: { name: "Transfers" }, isSystem: true },
      select: { id: true },
    }),
    prisma.category.findFirst({
      where: { name: "CC Payment", parent: { name: "Transfers" }, isSystem: true },
      select: { id: true },
    }),
  ])
  return { selfTransferId: self?.id ?? null, ccPaymentId: cc?.id ?? null }
}

export async function detectTransfers(userId: string): Promise<number> {
  const [rows, user, categoryIds] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, transferGroupId: null },
      select: {
        id: true,
        accountId: true,
        date: true,
        direction: true,
        amount: true,
        narration: true,
        counterparty: true,
        refNo: true,
        channel: true,
        account: { select: { type: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    transferCategoryIds(),
  ])

  const candidates: Candidate[] = rows.map((row) => ({
    id: row.id,
    accountId: row.accountId,
    accountType: row.account.type,
    date: row.date,
    direction: row.direction,
    amount: row.amount.toFixed(2),
    narration: row.narration.toUpperCase(),
    counterparty: row.counterparty,
    refNo: row.refNo,
    channel: row.channel,
    linked: false,
  }))

  // Tokens of the user's own name (≥4 chars) — matches both "RITIK KUSHWAHA"
  // narrations and VPA handles like RITIKKUSHWAHA1234-1@OKAXIS.
  const selfTokens = (user?.name ?? "")
    .toUpperCase()
    .split(/\s+/)
    .filter((token) => token.length >= 4)

  const mentionsSelf = (narration: string) =>
    selfTokens.some((token) => narration.includes(token))

  type Pair = { debit: Candidate; credit: Candidate; kind: "SELF_TRANSFER" | "CC_PAYMENT" }
  const pairs: Pair[] = []

  const pairUp = (debit: Candidate, credit: Candidate, kind: Pair["kind"]) => {
    debit.linked = true
    credit.linked = true
    pairs.push({ debit, credit, kind })
  }

  // Pass 1 — same payment reference seen from both banks.
  const byRef = new Map<string, Candidate[]>()
  for (const c of candidates) {
    if (c.refNo && /^\d{9,}$/.test(c.refNo)) {
      const key = `${c.refNo}|${c.amount}`
      byRef.set(key, [...(byRef.get(key) ?? []), c])
    }
  }
  for (const group of byRef.values()) {
    const debit = group.find((c) => c.direction === "DEBIT" && !c.linked)
    const credit = group.find(
      (c) => c.direction === "CREDIT" && !c.linked && c.accountId !== debit?.accountId
    )
    if (debit && credit) {
      pairUp(debit, credit, credit.accountType === "CREDIT_CARD" ? "CC_PAYMENT" : "SELF_TRANSFER")
    }
  }

  // Pass 2 — CC bill payments by amount + window.
  const ccCredits = candidates.filter(
    (c) => !c.linked && c.direction === "CREDIT" && c.accountType === "CREDIT_CARD" && c.channel === "CC_PAYMENT"
  )
  for (const credit of ccCredits) {
    const debit = candidates
      .filter(
        (c) =>
          !c.linked &&
          c.direction === "DEBIT" &&
          c.accountType === "SAVINGS" &&
          c.amount === credit.amount &&
          daysBetween(c.date, credit.date) <= 4
      )
      .sort((a, b) => daysBetween(a.date, credit.date) - daysBetween(b.date, credit.date))[0]
    if (debit) pairUp(debit, credit, "CC_PAYMENT")
  }

  // Pass 3 — self-transfers by amount + window + own-name signal.
  const debits = candidates.filter((c) => !c.linked && c.direction === "DEBIT")
  for (const debit of debits) {
    const credit = candidates
      .filter(
        (c) =>
          !c.linked &&
          c.direction === "CREDIT" &&
          c.accountId !== debit.accountId &&
          c.amount === debit.amount &&
          daysBetween(c.date, debit.date) <= 3 &&
          (mentionsSelf(c.narration) || mentionsSelf(debit.narration))
      )
      .sort((a, b) => daysBetween(a.date, debit.date) - daysBetween(b.date, debit.date))[0]
    if (credit) {
      pairUp(debit, credit, credit.accountType === "CREDIT_CARD" ? "CC_PAYMENT" : "SELF_TRANSFER")
    }
  }

  // Pass 4 — self-transfers a per-transaction fee makes uneven, so passes 1–3
  // (exact-amount) miss them. Tightly scoped to stay conservative: the DEBIT went
  // to a bare phone-number/VPA beneficiary (how a self IMPS to your own number
  // shows), a CREDIT in another account NAMES the user, and the debit exceeds the
  // credit by only a small fee (₹100,005.90 out ↔ ₹100,000 in, ₹5.90 IMPS charge).
  const SELF_FEE_MAX = 15 // ₹
  const isPhoneBeneficiary = (c: Candidate) => /^\d{10,12}$/.test((c.counterparty ?? "").trim())
  const feeDebits = candidates.filter(
    (c) => !c.linked && c.direction === "DEBIT" && isPhoneBeneficiary(c)
  )
  for (const debit of feeDebits) {
    const credit = candidates
      .filter((c) => {
        if (c.linked || c.direction !== "CREDIT" || c.accountId === debit.accountId) return false
        const fee = Number(debit.amount) - Number(c.amount)
        return (
          fee >= 0 &&
          fee <= SELF_FEE_MAX &&
          daysBetween(c.date, debit.date) <= 3 &&
          mentionsSelf(c.narration)
        )
      })
      .sort((a, b) => daysBetween(a.date, debit.date) - daysBetween(b.date, debit.date))[0]
    if (credit) {
      pairUp(debit, credit, credit.accountType === "CREDIT_CARD" ? "CC_PAYMENT" : "SELF_TRANSFER")
    }
  }

  if (!pairs.length) return 0

  // One set-based UPDATE for all pairs — per-row updates against a remote
  // Neon region blow Prisma's interactive-transaction timeout on big imports.
  const values = Prisma.join(
    pairs.flatMap((pair) => {
      const groupId = randomUUID()
      const categoryId =
        pair.kind === "CC_PAYMENT" ? categoryIds.ccPaymentId : categoryIds.selfTransferId
      return [pair.debit, pair.credit].map(
        (leg) =>
          Prisma.sql`(${leg.id}, ${groupId}, ${pair.kind}::text, ${categoryId}::text)`
      )
    })
  )
  await prisma.$executeRaw`
    UPDATE "Transaction" AS t
    SET "transferGroupId" = v.group_id,
        "transferKind"    = v.kind::"TransferKind",
        "excludeFromSpend" = true,
        "categoryId"      = COALESCE(v.category_id, t."categoryId")
    FROM (VALUES ${values}) AS v(id, group_id, kind, category_id)
    WHERE t.id = v.id
  `

  return pairs.length
}

/** Manually link/unlink from the UI. Re-includes both legs in spend. */
export async function unlinkTransfer(userId: string, transferGroupId: string): Promise<void> {
  const legs = await prisma.transaction.findMany({
    where: { userId, transferGroupId },
    select: { date: true },
  })
  await prisma.transaction.updateMany({
    where: { userId, transferGroupId },
    data: {
      transferGroupId: null,
      transferKind: null,
      excludeFromSpend: false,
      categoryId: null,
    },
  })
  const months = [...new Set(legs.map((leg) => leg.date.toISOString().slice(0, 7)))]
  if (months.length) await rebuildSummaries(userId, months)
}
