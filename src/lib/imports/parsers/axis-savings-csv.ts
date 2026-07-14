import { parse } from "papaparse"

import { type ParsedStatement, type ParsedTransaction, StatementParseError } from "@/lib/imports/types"
import { isoDate, normalizeWhitespace, parseAmount } from "@/lib/imports/values"

const HEADER_LINE = "Tran Date,CHQNO,PARTICULARS,DR,CR,BAL,SOL"
const DATE_FORMAT = "dd-MM-yyyy"
const STATEMENT_LINE =
  /Statement of Account No\s*-\s*(\d+)\s*for the period\s*\(From\s*:\s*(\d{2}-\d{2}-\d{4})\s*To\s*:\s*(\d{2}-\d{2}-\d{4})\)/

function metaValue(lines: string[], label: string): string | undefined {
  const prefix = `${label} :-`
  const line = lines.find((l) => l.startsWith(prefix))
  const value = line ? normalizeWhitespace(line.slice(prefix.length)) : ""
  return value && value !== "-" ? value : undefined
}

function toTransaction(row: string[], rowNumber: number): ParsedTransaction {
  const [rawDate, rawRefNo, rawNarration, rawDr, rawCr, rawBal] = row
  const date = isoDate(rawDate, DATE_FORMAT)
  if (!date) throw new StatementParseError(`Axis savings CSV: invalid transaction date "${rawDate}" at row ${rowNumber}`)
  const dr = parseAmount(rawDr)
  const cr = parseAmount(rawCr)
  const amount = dr ?? cr
  if (!amount || (dr && cr)) {
    throw new StatementParseError(`Axis savings CSV: expected exactly one of DR/CR at row ${rowNumber} (${date})`)
  }
  const refNo = normalizeWhitespace(rawRefNo ?? "")
  const balance = parseAmount(rawBal)
  return {
    date,
    narration: normalizeWhitespace(rawNarration ?? ""),
    ...(refNo && refNo !== "-" ? { refNo } : {}),
    amount: amount.value,
    direction: dr ? "DEBIT" : "CREDIT",
    ...(balance ? { balanceAfter: balance.negative ? `-${balance.value}` : balance.value } : {}),
  }
}

export function parseAxisSavingsCsv(buffer: Buffer): ParsedStatement {
  const text = buffer.toString("utf8")
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/)
  const headerIndex = lines.findIndex((line) => line.trim() === HEADER_LINE)
  if (headerIndex === -1) {
    throw new StatementParseError("Axis savings CSV: transaction header row (Tran Date,CHQNO,…) not found")
  }

  const metaLines = lines.slice(0, headerIndex)
  const statementLine = metaLines.map((l) => l.match(STATEMENT_LINE)).find((m) => m !== null)
  if (!statementLine) {
    throw new StatementParseError("Axis savings CSV: statement-of-account line with account number and period not found")
  }
  const [, accountNumber, rawFrom, rawTo] = statementLine
  const periodStart = isoDate(rawFrom, DATE_FORMAT)
  const periodEnd = isoDate(rawTo, DATE_FORMAT)
  if (!periodStart || !periodEnd) {
    throw new StatementParseError(`Axis savings CSV: invalid statement period "${rawFrom}" to "${rawTo}"`)
  }

  // Feed only the transaction section to papaparse; the metadata block above the
  // header is not CSV, and the footer below the data is cut by the date gate.
  const parsed = parse<string[]>(lines.slice(headerIndex + 1).join("\n"), { skipEmptyLines: false })
  const transactions: ParsedTransaction[] = []
  for (const [index, row] of parsed.data.entries()) {
    if (!/^\d{2}-\d{2}-\d{4}$/.test(row[0]?.trim() ?? "")) break
    transactions.push(toTransaction(row, index + 1))
  }
  if (transactions.length === 0) {
    throw new StatementParseError("Axis savings CSV: no transaction rows found under the header")
  }

  return {
    kind: "STATEMENT",
    fileType: "AXIS_SAVINGS_CSV",
    account: {
      bank: "Axis Bank",
      accountNumber,
      type: "SAVINGS",
      name: "Axis Bank Savings",
      ifsc: metaValue(metaLines, "IFSC Code"),
      holderName: metaValue(metaLines, "Name"),
    },
    periodStart,
    periodEnd,
    transactions,
  }
}
