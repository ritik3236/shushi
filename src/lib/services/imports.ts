import "server-only"

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { matchCategory, type MatchableRule } from "@/lib/categorize/engine"
import { parseStatementFile } from "@/lib/imports/detect"
import { assignOccurrences, buildDedupeKey, hashFile } from "@/lib/imports/dedupe"
import { parseNarration } from "@/lib/imports/narration"
import type {
  ImportFileType,
  ParsedAccount,
  ParsedPayslip,
  ParsedStatement,
} from "@/lib/imports/types"
import { invalidateFilterOptions } from "@/lib/services/filter-options-cache"
import { correctedPeriodMonth } from "@/lib/imports/payslip-corrections"
import { createPayslipFromParsed, matchPayslips } from "@/lib/services/payslips"
import { rebuildSummaries } from "@/lib/services/summaries"
import { detectTransfers } from "@/lib/transfers/detect"
import { NotFoundError, ValidationError } from "@/lib/errors"

// The import pipeline: upload → parse+enrich → PENDING import with the
// normalized rows in payload → user reviews the preview → commit inserts
// idempotently and runs transfer/payslip linking.

type PayloadRow = {
  date: string
  valueDate?: string
  narration: string
  refNo?: string
  amount: string
  direction: "DEBIT" | "CREDIT"
  balanceAfter?: string
  occurrence: number
  dedupeKey: string
  channel: string
  counterparty?: string
  categoryId: string | null
  excludeFromSpend: boolean
  /** null = new; "content" = same hash (unforceable); "ref" = same UPI ref. */
  duplicateReason: "content" | "ref" | null
}

type StatementPayload = {
  kind: "STATEMENT"
  account: ParsedAccount
  periodStart?: string
  periodEnd?: string
  statementMeta?: Record<string, string>
  rows: PayloadRow[]
}

type PayslipPayload = {
  kind: "PAYSLIP"
  parsed: ParsedPayslip
}

export type PreviewRow = {
  date: string
  narration: string
  counterparty: string | null
  amount: string
  direction: "DEBIT" | "CREDIT"
  duplicate: boolean
  /** Why it's a duplicate — a "ref" dup can be force-imported; "content" can't. */
  duplicateReason: "content" | "ref" | null
  refNo: string | null
  categoryName: string | null
}

export type ImportPreview = {
  importId: string
  fileName: string
  fileType: ImportFileType
  kind: "STATEMENT" | "PAYSLIP"
  /** An identical file was already committed — row dedupe still applies. */
  duplicateFile: boolean
  account: {
    name: string
    bank: string
    accountNumber: string
    type: "SAVINGS" | "CREDIT_CARD"
    exists: boolean
  } | null
  periodStart: string | null
  periodEnd: string | null
  statementMeta: Record<string, string> | null
  totals: { rows: number; new: number; duplicates: number; autoCategorized: number }
  rows: PreviewRow[]
  payslip: {
    kind: "SALARY" | "CONTRACTOR_FEE"
    employer: string
    periodMonth: string
    grossEarnings: string
    totalDeductions: string
    netPay: string
    earnings: { label: string; amount: string }[]
    deductions: { label: string; amount: string }[]
    alreadyImported: boolean
  } | null
}

export type CommitResult = {
  kind: "STATEMENT" | "PAYSLIP"
  imported: number
  duplicates: number
  transfersLinked: number
  payslipsMatched: number
  accountId: string | null
}

const PREVIEW_ROW_CAP = 500

async function loadRules(userId: string): Promise<MatchableRule[]> {
  const rules = await prisma.categoryRule.findMany({
    where: { OR: [{ userId }, { isSystem: true }] },
    select: {
      id: true,
      pattern: true,
      field: true,
      match: true,
      direction: true,
      categoryId: true,
      priority: true,
    },
  })
  return rules
}

async function ccPaymentCategoryId(): Promise<string | null> {
  const category = await prisma.category.findFirst({
    where: { name: "CC Payment", parent: { name: "Transfers" }, isSystem: true },
    select: { id: true },
  })
  return category?.id ?? null
}

export async function previewStatementFile(input: {
  userId: string
  fileName: string
  buffer: Buffer
  password?: string
}): Promise<ImportPreview> {
  const { userId, fileName, buffer, password } = input
  const fileHash = hashFile(buffer)
  const parsed = await parseStatementFile(buffer, password)

  const duplicateFile = Boolean(
    await prisma.statementImport.findFirst({
      where: { userId, fileHash, status: "COMMITTED" },
      select: { id: true },
    })
  )

  if (parsed.kind === "PAYSLIP") {
    const alreadyImported = Boolean(
      await prisma.payslip.findUnique({
        where: { userId_fileHash: { userId, fileHash } },
        select: { id: true },
      })
    )
    const payload: PayslipPayload = { kind: "PAYSLIP", parsed }
    const statementImport = await prisma.statementImport.create({
      data: {
        userId,
        fileName,
        fileType: parsed.fileType,
        fileHash,
        fileData: new Uint8Array(buffer),
        fileSize: buffer.length,
        payload: payload as unknown as Prisma.InputJsonValue,
        rowCount: 1,
      },
    })
    return {
      importId: statementImport.id,
      fileName,
      fileType: parsed.fileType,
      kind: "PAYSLIP",
      duplicateFile,
      account: null,
      periodStart: null,
      periodEnd: null,
      statementMeta: null,
      totals: { rows: 1, new: alreadyImported ? 0 : 1, duplicates: alreadyImported ? 1 : 0, autoCategorized: 0 },
      rows: [],
      payslip: {
        kind: parsed.payslipKind,
        employer: parsed.employer,
        periodMonth: correctedPeriodMonth(parsed),
        grossEarnings: parsed.grossEarnings,
        totalDeductions: parsed.totalDeductions,
        netPay: parsed.netPay,
        earnings: parsed.earnings,
        deductions: parsed.deductions,
        alreadyImported,
      },
    }
  }

  return previewStatement({ userId, fileName, fileHash, buffer, parsed, duplicateFile })
}

/**
 * Which of `refs` already exist on this account. A UPI/IMPS reference is the
 * one stable, source-independent identity a transaction has — the SAME across a
 * GPay statement, a bank statement, and a manual entry, even when their
 * narration text differs. So a ref that already exists on the account marks a
 * re-arriving duplicate the content-hash `dedupeKey` can't catch. Deliberately
 * account-scoped: the same ref in a DIFFERENT account is the opposite leg of a
 * self-transfer (transfer detection links those), never a duplicate.
 */
async function existingRefNos(
  accountId: string,
  refs: (string | undefined)[]
): Promise<Set<string>> {
  const list = refs.filter((r): r is string => Boolean(r))
  if (!list.length) return new Set()
  const rows = await prisma.transaction.findMany({
    where: { accountId, refNo: { in: list } },
    select: { refNo: true },
  })
  return new Set(rows.map((r) => r.refNo as string))
}

async function previewStatement(input: {
  userId: string
  fileName: string
  fileHash: string
  buffer: Buffer
  parsed: ParsedStatement
  duplicateFile: boolean
}): Promise<ImportPreview> {
  const { userId, fileName, fileHash, buffer, parsed, duplicateFile } = input

  const account = await prisma.account.findUnique({
    where: {
      userId_accountNumber: { userId, accountNumber: parsed.account.accountNumber },
    },
    select: { id: true },
  })

  const [rules, categories, ccPaymentId] = await Promise.all([
    loadRules(userId),
    prisma.category.findMany({
      select: { id: true, name: true, parent: { select: { name: true } } },
    }),
    ccPaymentCategoryId(),
  ])
  const categoryNameById = new Map(
    categories.map((c) => [c.id, c.parent ? `${c.parent.name} › ${c.name}` : c.name])
  )

  const withOccurrences = assignOccurrences(parsed.transactions)
  const enriched: PayloadRow[] = withOccurrences.map((row) => {
    const info = parseNarration(row.narration, parsed.fileType)
    const isCcPayment = info.channel === "CC_PAYMENT"
    const categoryId = isCcPayment
      ? ccPaymentId
      : matchCategory(rules, {
          narration: row.narration,
          counterparty: info.counterparty,
          direction: row.direction,
        })
    return {
      date: row.date,
      valueDate: row.valueDate,
      narration: row.narration,
      refNo: row.refNo ?? info.upiRef,
      amount: row.amount,
      direction: row.direction,
      balanceAfter: row.balanceAfter,
      occurrence: row.occurrence,
      dedupeKey: buildDedupeKey(row),
      channel: info.channel,
      counterparty: info.counterparty,
      categoryId,
      excludeFromSpend: isCcPayment,
      duplicateReason: null,
    }
  })

  // Mark rows already present in this account. Two independent signals: same
  // content hash (a re-import of the same statement) OR same UPI/IMPS ref (the
  // same payment re-arriving from a different source — manual entry, or a bank
  // statement vs a GPay statement — whose narration differs so the hash misses
  // it). Ref match is account-scoped (see existingRefNos).
  if (account && enriched.length) {
    const [byKey, existingRefs] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          accountId: account.id,
          dedupeKey: { in: enriched.map((row) => row.dedupeKey) },
        },
        select: { dedupeKey: true },
      }),
      existingRefNos(
        account.id,
        enriched.map((row) => row.refNo)
      ),
    ])
    const existingKeys = new Set(byKey.map((row) => row.dedupeKey))
    for (const row of enriched) {
      row.duplicateReason = existingKeys.has(row.dedupeKey)
        ? "content"
        : !!row.refNo && existingRefs.has(row.refNo)
          ? "ref"
          : null
    }
  }

  const payload: StatementPayload = {
    kind: "STATEMENT",
    account: parsed.account,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    statementMeta: parsed.statementMeta,
    rows: enriched,
  }

  const statementImport = await prisma.statementImport.create({
    data: {
      userId,
      accountId: account?.id ?? null,
      fileName,
      fileType: parsed.fileType,
      fileHash,
      fileData: new Uint8Array(buffer),
      fileSize: buffer.length,
      payload: payload as unknown as Prisma.InputJsonValue,
      rowCount: enriched.length,
    },
  })

  const duplicates = enriched.filter((row) => row.duplicateReason !== null).length
  const autoCategorized = enriched.filter(
    (row) => row.categoryId && row.duplicateReason === null
  ).length

  return {
    importId: statementImport.id,
    fileName,
    fileType: parsed.fileType,
    kind: "STATEMENT",
    duplicateFile,
    account: {
      name: parsed.account.name,
      bank: parsed.account.bank,
      accountNumber: parsed.account.accountNumber,
      type: parsed.account.type,
      exists: Boolean(account),
    },
    periodStart: parsed.periodStart ?? null,
    periodEnd: parsed.periodEnd ?? null,
    statementMeta: parsed.statementMeta ?? null,
    totals: {
      rows: enriched.length,
      new: enriched.length - duplicates,
      duplicates,
      autoCategorized,
    },
    rows: enriched.slice(0, PREVIEW_ROW_CAP).map((row) => ({
      date: row.date,
      narration: row.narration,
      counterparty: row.counterparty ?? null,
      amount: row.amount,
      direction: row.direction,
      duplicate: row.duplicateReason !== null,
      duplicateReason: row.duplicateReason,
      refNo: row.refNo ?? null,
      categoryName: row.categoryId ? (categoryNameById.get(row.categoryId) ?? null) : null,
    })),
    payslip: null,
  }
}

export async function commitImport(
  userId: string,
  importId: string,
  forceRefNos: string[] = []
): Promise<CommitResult> {
  const statementImport = await prisma.statementImport.findFirst({
    where: { id: importId, userId },
  })
  if (!statementImport) throw new NotFoundError("Import not found.")
  if (statementImport.status !== "PENDING") {
    throw new ValidationError("This import was already committed.")
  }
  const payload = statementImport.payload as unknown as StatementPayload | PayslipPayload | null
  if (!payload) throw new ValidationError("Import has no parsed data — upload the file again.")

  if (payload.kind === "PAYSLIP") {
    const { created } = await createPayslipFromParsed({
      userId,
      parsed: payload.parsed,
      fileName: statementImport.fileName,
      fileHash: statementImport.fileHash,
      importId,
    })
    const payslipsMatched = await matchPayslips(userId)
    await prisma.statementImport.update({
      where: { id: importId },
      data: {
        status: "COMMITTED",
        committedAt: new Date(),
        importedCount: created ? 1 : 0,
        duplicateCount: created ? 0 : 1,
        payload: Prisma.DbNull,
      },
    })
    // A matched payout can (re)categorize its bank credit → rebuild rollups.
    if (payslipsMatched > 0) await rebuildSummaries(userId)
    return {
      kind: "PAYSLIP",
      imported: created ? 1 : 0,
      duplicates: created ? 0 : 1,
      transfersLinked: 0,
      payslipsMatched,
      accountId: null,
    }
  }

  const account = await prisma.account.upsert({
    where: {
      userId_accountNumber: { userId, accountNumber: payload.account.accountNumber },
    },
    update: {
      ifsc: payload.account.ifsc ?? undefined,
      creditLimit: payload.account.creditLimit ?? undefined,
    },
    create: {
      userId,
      name: payload.account.name,
      bank: payload.account.bank,
      type: payload.account.type,
      accountNumber: payload.account.accountNumber,
      ifsc: payload.account.ifsc ?? null,
      creditLimit: payload.account.creditLimit ?? null,
    },
  })

  // Skip rows whose UPI/IMPS ref already exists on this account — the same
  // payment re-arriving from another source, which the @@unique(accountId,
  // dedupeKey) constraint alone wouldn't catch when the narration differs.
  // Account-scoped, so a transfer's other leg (same ref, different account)
  // still imports. Ref-less rows (interest, fees, cash) fall through to the
  // content-hash constraint below.
  const existingRefs = await existingRefNos(
    account.id,
    payload.rows.map((row) => row.refNo)
  )
  // Rows the user ticked "import anyway" survive the ref filter.
  const forced = new Set(forceRefNos)
  const rowsToInsert = payload.rows.filter(
    (row) => !row.refNo || !existingRefs.has(row.refNo) || forced.has(row.refNo)
  )

  const result = await prisma.transaction.createMany({
    data: rowsToInsert.map((row) => ({
      userId,
      accountId: account.id,
      importId,
      date: new Date(row.date),
      valueDate: row.valueDate ? new Date(row.valueDate) : null,
      narration: row.narration,
      refNo: row.refNo ?? null,
      channel: row.channel,
      counterparty: row.counterparty ?? null,
      direction: row.direction,
      amount: row.amount,
      balanceAfter: row.balanceAfter ?? null,
      categoryId: row.categoryId,
      dedupeKey: row.dedupeKey,
      occurrence: row.occurrence,
      excludeFromSpend: row.excludeFromSpend,
      source: "IMPORT" as const,
    })),
    skipDuplicates: true,
  })

  await prisma.statementImport.update({
    where: { id: importId },
    data: {
      status: "COMMITTED",
      committedAt: new Date(),
      accountId: account.id,
      importedCount: result.count,
      duplicateCount: payload.rows.length - result.count,
      periodStart: payload.periodStart ? new Date(payload.periodStart) : null,
      periodEnd: payload.periodEnd ? new Date(payload.periodEnd) : null,
      statementMeta: (payload.statementMeta ?? {}) as Prisma.InputJsonValue,
      payload: Prisma.DbNull,
    },
  })

  const transfersLinked = await detectTransfers(userId)
  const payslipsMatched = await matchPayslips(userId)

  // Rebuild the whole rollup: the insert plus transfer/payslip linking can
  // touch arbitrary months, and this only runs on commit (cheap at this scale).
  await rebuildSummaries(userId)
  invalidateFilterOptions(userId) // new months/accounts/tags may exist

  return {
    kind: "STATEMENT",
    imported: result.count,
    duplicates: payload.rows.length - result.count,
    transfersLinked,
    payslipsMatched,
    accountId: account.id,
  }
}

export async function discardImport(userId: string, importId: string): Promise<void> {
  await prisma.statementImport.deleteMany({
    where: { id: importId, userId, status: "PENDING" },
  })
}

export type ImportListRow = {
  id: string
  fileName: string
  fileType: ImportFileType
  status: "PENDING" | "COMMITTED" | "FAILED"
  accountName: string | null
  periodStart: string | null
  periodEnd: string | null
  rowCount: number
  importedCount: number
  duplicateCount: number
  createdAt: string
  /** Original file kept in the DB — downloadable at /api/imports/{id}/file. */
  hasFile: boolean
  fileSize: number | null
}

export async function listImports(userId: string): Promise<ImportListRow[]> {
  const imports = await prisma.statementImport.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    // Never pull the raw bytes or the pending payload into a list query.
    omit: { fileData: true, payload: true },
    include: { account: { select: { name: true } } },
    take: 100,
  })
  return imports.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    fileType: row.fileType,
    status: row.status,
    accountName: row.account?.name ?? null,
    periodStart: row.periodStart?.toISOString().slice(0, 10) ?? null,
    periodEnd: row.periodEnd?.toISOString().slice(0, 10) ?? null,
    rowCount: row.rowCount,
    importedCount: row.importedCount,
    duplicateCount: row.duplicateCount,
    createdAt: row.createdAt.toISOString(),
    hasFile: row.fileSize != null && row.fileSize > 0,
    fileSize: row.fileSize,
  }))
}
