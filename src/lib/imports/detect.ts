import { decrypt, isEncrypted } from "officecrypto-tool"

import { parseAxisCcXlsx } from "@/lib/imports/parsers/axis-cc-xlsx"
import { parseAxisSavingsCsv } from "@/lib/imports/parsers/axis-savings-csv"
import { parseGpayStatement, isGpayStatement } from "@/lib/imports/parsers/gpay-statement-pdf"
import { parseHdfcSavingsXls } from "@/lib/imports/parsers/hdfc-savings-xls"
import { parsePayslipText } from "@/lib/imports/parsers/payslip-pdf"
import { extractPdfText } from "@/lib/imports/pdf"
import { StatementParseError, type ParseResult } from "@/lib/imports/types"

/** Thrown when the file is password-protected and no/wrong password was given. */
export class PasswordRequiredError extends Error {
  constructor(message = "This file is password-protected. Enter the file password to import it.") {
    super(message)
    this.name = "PasswordRequiredError"
  }
}

const isPdf = (buffer: Buffer) => buffer.subarray(0, 5).toString("latin1") === "%PDF-"
const isZip = (buffer: Buffer) => buffer[0] === 0x50 && buffer[1] === 0x4b
// Compound File Binary — old .xls, or any password-encrypted Office file.
const isCfb = (buffer: Buffer) => buffer[0] === 0xd0 && buffer[1] === 0xcf

/**
 * Sniff the file format from content (never the filename), decrypt when needed,
 * and dispatch to the right parser.
 */
export async function parseStatementFile(
  buffer: Buffer,
  password?: string
): Promise<ParseResult> {
  if (isPdf(buffer)) {
    // Extract once, then sniff: GPay statements and BizDaddy payslips are both PDFs.
    const text = await extractPdfText(buffer)
    if (isGpayStatement(text)) return parseGpayStatement(text)
    return parsePayslipText(text)
  }

  if (isZip(buffer)) {
    // Plain .xlsx (encrypted ones are CFB-wrapped, handled below).
    return parseAxisCcXlsx(buffer)
  }

  if (isCfb(buffer)) {
    if (isEncrypted(buffer)) {
      if (!password) throw new PasswordRequiredError()
      let decrypted: Buffer
      try {
        decrypted = await decrypt(buffer, { password })
      } catch {
        throw new PasswordRequiredError("Wrong password for this file. Check it and try again.")
      }
      return parseStatementFile(decrypted)
    }
    return parseHdfcSavingsXls(buffer)
  }

  const head = buffer.subarray(0, 4096).toString("utf8")
  if (head.includes("Tran Date,CHQNO") || head.includes("Statement of Account No")) {
    return parseAxisSavingsCsv(buffer)
  }

  throw new StatementParseError(
    "Unrecognized file format. Supported: Axis savings CSV, HDFC savings XLS, Axis credit card XLSX, BizDaddy payslip PDF."
  )
}
