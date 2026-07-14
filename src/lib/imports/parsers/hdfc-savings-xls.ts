import * as XLSX from "xlsx"

import { StatementParseError } from "@/lib/imports/types"
import type { ParsedStatement, ParsedTransaction } from "@/lib/imports/types"
import { isoDate, isoFromExcelSerial, normalizeWhitespace, parseAmount } from "@/lib/imports/values"

// HDFC Bank savings-account statement, old BIFF .xls export ("Statement of
// accounts"). Layout: ~18 labeled header rows, an asterisk separator, a
// column-header row (Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal
// Amt. | Deposit Amt. | Closing Balance), another asterisk row, then data rows
// until a trailing asterisk/footer block ("STATEMENT SUMMARY", "--- End Of
// Statement ---").

type Cell = string | number | null

function isBlank(cell: Cell): boolean {
  return cell == null || (typeof cell === "string" && cell.trim() === "")
}

// Date cells are usually "dd/MM/yy" strings but can surface as Excel serials
// depending on how the cell was typed.
function cellDate(cell: Cell): string | null {
  if (typeof cell === "number") return isoFromExcelSerial(cell)
  if (typeof cell === "string") return isoDate(cell, "dd/MM/yy")
  return null
}

function signedAmount(cell: Cell): string | null {
  const parsed = parseAmount(cell)
  if (!parsed) return null
  return parsed.negative ? `-${parsed.value}` : parsed.value
}

// All-zero refs ("000000000000000") are HDFC's placeholder for "no reference".
function cleanRefNo(cell: Cell): string | undefined {
  if (cell == null) return undefined
  const trimmed = String(cell).trim()
  if (!trimmed || /^0+$/.test(trimmed)) return undefined
  return trimmed
}

function isAsteriskRow(cell: Cell): boolean {
  return typeof cell === "string" && /^\*+$/.test(cell.trim())
}

export function parseHdfcSavingsXls(buffer: Buffer): ParsedStatement {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: "buffer" })
  } catch {
    throw new StatementParseError("Not a readable XLS workbook")
  }
  const sheetName = workbook.SheetNames[0]
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined
  if (!sheet) throw new StatementParseError("XLS workbook has no sheets")

  const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: null })

  let accountNumber: string | undefined
  let ifsc: string | undefined
  let holderName: string | undefined
  let periodStart: string | undefined
  let periodEnd: string | undefined
  let headerRowIndex = -1

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row[0] === "Date" && row[1] === "Narration") {
      headerRowIndex = i
      break
    }
    for (const cell of row) {
      if (typeof cell !== "string") continue
      const account = cell.match(/Account No\s*:\s*(\d+)/)
      if (account) accountNumber = account[1]
      const ifscMatch = cell.match(/RTGS\/NEFT IFSC\s*:\s*([A-Z]{4}0[A-Z0-9]{6})/)
      if (ifscMatch) ifsc = ifscMatch[1]
      const period = cell.match(
        /Statement From\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*To\s*:\s*(\d{2}\/\d{2}\/\d{4})/,
      )
      if (period) {
        periodStart = isoDate(period[1], "dd/MM/yyyy") ?? undefined
        periodEnd = isoDate(period[2], "dd/MM/yyyy") ?? undefined
      }
      // The holder name sits in column 0 of the same row as the branch
      // "Address :" label — the address block has no label of its own.
      if (/^Address\s*:/.test(cell) && typeof row[0] === "string" && row[0].trim()) {
        holderName = normalizeWhitespace(row[0])
      }
    }
  }

  if (headerRowIndex < 0) {
    throw new StatementParseError("No Date/Narration column header — not an HDFC savings XLS statement")
  }
  if (!accountNumber) {
    throw new StatementParseError("No \"Account No :\" cell in the HDFC statement header")
  }

  const transactions: ParsedTransaction[] = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const dateCell = row[0]
    if (isAsteriskRow(dateCell)) {
      // Separator directly under the column header; a second one closes the
      // data region.
      if (transactions.length === 0) continue
      break
    }
    if (row.every(isBlank)) continue

    const date = cellDate(dateCell)
    if (date == null) {
      // Continuation row: a long narration wrapped onto a row where only the
      // Narration cell is populated — belongs to the previous transaction.
      const wrapped = row[1]
      const previous = transactions[transactions.length - 1]
      if (
        previous &&
        isBlank(dateCell) &&
        typeof wrapped === "string" &&
        wrapped.trim() !== "" &&
        row.slice(2).every(isBlank)
      ) {
        previous.narration = `${previous.narration} ${normalizeWhitespace(wrapped)}`
        continue
      }
      // Footer / statement-summary block: end of data.
      break
    }

    const withdrawal = parseAmount(row[4])
    const deposit = parseAmount(row[5])
    if (withdrawal && deposit) {
      throw new StatementParseError(`Row ${i + 1}: both withdrawal and deposit amounts present`)
    }
    const amount = withdrawal ?? deposit
    if (!amount) {
      throw new StatementParseError(`Row ${i + 1}: neither withdrawal nor deposit amount present`)
    }

    transactions.push({
      date,
      valueDate: cellDate(row[3]) ?? undefined,
      narration: typeof row[1] === "string" ? normalizeWhitespace(row[1]) : "",
      refNo: cleanRefNo(row[2]),
      amount: amount.value,
      direction: withdrawal ? "DEBIT" : "CREDIT",
      balanceAfter: signedAmount(row[6]) ?? undefined,
    })
  }

  return {
    kind: "STATEMENT",
    fileType: "HDFC_SAVINGS_XLS",
    account: {
      bank: "HDFC Bank",
      accountNumber,
      type: "SAVINGS",
      name: "HDFC Bank Savings",
      ifsc,
      holderName,
    },
    // Data rows are chronological, so fall back to first/last when the
    // "Statement From ... To ..." header line is absent.
    periodStart: periodStart ?? transactions[0]?.date,
    periodEnd: periodEnd ?? transactions[transactions.length - 1]?.date,
    transactions,
  }
}
