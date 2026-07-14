import { read, utils } from "xlsx"

import { StatementParseError } from "@/lib/imports/types"
import type { ParsedStatement, ParsedTransaction } from "@/lib/imports/types"
import { isoDate, isoFromExcelSerial, normalizeWhitespace, parseAmount } from "@/lib/imports/values"

type Cell = string | number | null | undefined
type Row = Cell[]

const SHEET_NAME = "Transactions Summary"
const TITLE_MARKER = "Axis Bank Flipkart Credit Card Monthly Statement"
// "12 Jun '26" — the doubled quote is Luxon's escape for a literal apostrophe.
const DATE_FORMAT = "dd MMM ''yy"

// The statement never prints the card number, so the account id is synthetic.
const ACCOUNT_NUMBER = "AXIS-FLIPKART-CC"

/** Signed decimal string; "-0.00" collapses to "0.00". */
function signedAmount(raw: string, label: string): string {
  const parsed = parseAmount(raw)
  if (!parsed) throw new StatementParseError(`unparseable amount for "${label}": "${raw}"`)
  if (parsed.value === "0.00") return parsed.value
  return parsed.negative ? `-${parsed.value}` : parsed.value
}

function cellDate(raw: Cell): string | null {
  if (typeof raw === "number") return isoFromExcelSerial(raw)
  if (typeof raw === "string") return isoDate(raw, DATE_FORMAT)
  return null
}

/**
 * Parse an Axis Bank Flipkart credit-card monthly statement XLSX
 * ("Transactions Summary" sheet: payment-summary cells holding "label\nvalue"
 * pairs, then a Date/Details/Amount/Debit-Credit table).
 */
export function parseAxisCcXlsx(buffer: Buffer): ParsedStatement {
  let rows: Row[]
  try {
    const workbook = read(buffer, { type: "buffer" })
    const sheet = workbook.Sheets[SHEET_NAME]
    if (!sheet) throw new StatementParseError(`sheet "${SHEET_NAME}" not found in workbook`)
    rows = utils.sheet_to_json<Row>(sheet, { header: 1 })
  } catch (error) {
    if (error instanceof StatementParseError) throw error
    throw new StatementParseError("not a readable XLSX file")
  }

  const titleRow = rows.find((row) =>
    row.some((cell) => typeof cell === "string" && cell.includes(TITLE_MARKER)),
  )
  if (!titleRow) {
    throw new StatementParseError(`"${TITLE_MARKER}" title not found — not an Axis CC statement`)
  }
  // First cell of the title row is "HOLDER NAME\naddress line(s)".
  const holderName =
    typeof titleRow[0] === "string" ? normalizeWhitespace(titleRow[0].split("\n")[0]) : undefined

  const headerIndex = rows.findIndex(
    (row) => row.includes("Date") && row.includes("Transaction Details"),
  )
  if (headerIndex < 0) throw new StatementParseError("transaction header row not found")
  const header = rows[headerIndex]
  const dateCol = header.indexOf("Date")
  const detailsCol = header.indexOf("Transaction Details")
  const amountCol = header.findIndex((cell) => typeof cell === "string" && cell.startsWith("Amount"))
  const directionCol = header.indexOf("Debit/Credit")
  if (amountCol < 0 || directionCol < 0) {
    throw new StatementParseError("Amount or Debit/Credit column not found in header row")
  }

  // Summary cells each hold a "label\nvalue" pair; positions vary, so scan
  // every cell above the transaction table.
  const summary = new Map<string, string>()
  for (const row of rows.slice(0, headerIndex)) {
    for (const cell of row) {
      if (typeof cell !== "string") continue
      const newline = cell.indexOf("\n")
      if (newline < 0) continue
      summary.set(cell.slice(0, newline).trim(), cell.slice(newline + 1).trim())
    }
  }
  const summaryValue = (label: string): string => {
    const value = summary.get(label)
    if (!value) throw new StatementParseError(`"${label}" not found in payment summary`)
    return value
  }

  const statementMonth = isoDate(summaryValue("Selected Statement Month"), "MMM yyyy")?.slice(0, 7)
  if (!statementMonth) {
    throw new StatementParseError(
      `unparseable statement month: "${summaryValue("Selected Statement Month")}"`,
    )
  }
  const dueDate = isoDate(summaryValue("Payment Due Date"), DATE_FORMAT)
  if (!dueDate) {
    throw new StatementParseError(`unparseable due date: "${summaryValue("Payment Due Date")}"`)
  }
  const creditLimit = parseAmount(summaryValue("Credit Limit"))
  if (!creditLimit) {
    throw new StatementParseError(`unparseable credit limit: "${summaryValue("Credit Limit")}"`)
  }

  const transactions: ParsedTransaction[] = []
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const rawDate = row?.[dateCol]
    if (rawDate == null || rawDate === "" || String(rawDate).startsWith("**")) break
    const date = cellDate(rawDate)
    if (!date) throw new StatementParseError(`unparseable transaction date on row ${i + 1}: "${rawDate}"`)
    const amount = parseAmount(row[amountCol])
    if (!amount) {
      throw new StatementParseError(`unparseable transaction amount on row ${i + 1}: "${row[amountCol]}"`)
    }
    const directionCell = row[directionCol]
    const rawDirection = typeof directionCell === "string" ? directionCell.trim() : ""
    if (rawDirection !== "Debit" && rawDirection !== "Credit") {
      throw new StatementParseError(`unexpected Debit/Credit value on row ${i + 1}: "${directionCell}"`)
    }
    transactions.push({
      date,
      narration: normalizeWhitespace(String(row[detailsCol] ?? "")),
      amount: amount.value,
      direction: rawDirection === "Debit" ? "DEBIT" : "CREDIT",
    })
  }
  if (transactions.length === 0) throw new StatementParseError("no transaction rows found")

  // Billing cycles span two calendar months, so the period is the observed
  // min/max transaction date (ISO strings sort lexicographically).
  const dates = transactions.map((tx) => tx.date).sort()

  return {
    kind: "STATEMENT",
    fileType: "AXIS_CC_XLSX",
    account: {
      bank: "Axis Bank",
      accountNumber: ACCOUNT_NUMBER,
      type: "CREDIT_CARD",
      name: "Axis Flipkart Credit Card",
      creditLimit: creditLimit.value,
      holderName,
    },
    periodStart: dates[0],
    periodEnd: dates[dates.length - 1],
    statementMeta: {
      statementMonth,
      totalDue: signedAmount(summaryValue("Total Payment Due"), "Total Payment Due"),
      minDue: signedAmount(summaryValue("Minimum Payment Due"), "Minimum Payment Due"),
      dueDate,
      openingBalance: signedAmount(summaryValue("Opening Balance"), "Opening Balance"),
      creditLimit: creditLimit.value,
    },
    transactions,
  }
}
