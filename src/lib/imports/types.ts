// Normalized output contract for every statement/payslip parser. Parsers are
// pure: Buffer in, one of these out — no DB access, no narration enrichment
// (channel/counterparty extraction happens in the import pipeline).
//
// Money is ALWAYS a decimal string with exactly two fraction digits
// (e.g. "187831.61"), positive unless stated otherwise. Dates are ISO
// yyyy-MM-dd strings.

export type ImportFileType =
  | "AXIS_SAVINGS_CSV"
  | "HDFC_SAVINGS_XLS"
  | "AXIS_CC_XLSX"
  | "GPAY_STATEMENT_PDF"
  | "PAYSLIP_PDF"
  | "CONTRACTOR_FEE_PDF"

export type ParsedTransaction = {
  /** Transaction date, ISO yyyy-MM-dd. */
  date: string
  /** Value date when the statement shows one. */
  valueDate?: string
  /** Narration exactly as printed (whitespace collapsed). */
  narration: string
  /** Cheque/reference number when present and meaningful (not "-"/zeros). */
  refNo?: string
  /** Positive decimal string. */
  amount: string
  direction: "DEBIT" | "CREDIT"
  /** Running balance after this row, when the statement carries one. Signed. */
  balanceAfter?: string
}

export type ParsedAccount = {
  /** e.g. "Axis Bank", "HDFC Bank" */
  bank: string
  /**
   * Stable identifier across statements of the same account: the full account
   * number when printed, otherwise a stable synthetic id for the product
   * (e.g. "AXIS-FLIPKART-CC" — the CC statement never prints the card number).
   */
  accountNumber: string
  type: "SAVINGS" | "CREDIT_CARD"
  /** Display name, e.g. "Axis Bank Savings", "Axis Flipkart Credit Card". */
  name: string
  ifsc?: string
  /** Positive decimal string. */
  creditLimit?: string
  /** Account holder name as printed. */
  holderName?: string
}

export type ParsedStatement = {
  kind: "STATEMENT"
  fileType: "AXIS_SAVINGS_CSV" | "HDFC_SAVINGS_XLS" | "AXIS_CC_XLSX" | "GPAY_STATEMENT_PDF"
  account: ParsedAccount
  /** Statement period when printed; otherwise min/max transaction date. */
  periodStart?: string
  periodEnd?: string
  /**
   * Format-specific summary, JSON-safe. For the CC statement:
   * { statementMonth: "2026-06", totalDue: "-187831.61", minDue: "0.00",
   *   dueDate: "2026-07-03", openingBalance: "74158.54", creditLimit: "200000.00" }
   * (totalDue/openingBalance keep their sign — negative means credit balance).
   */
  statementMeta?: Record<string, string>
  transactions: ParsedTransaction[]
}

export type PayslipLineItem = {
  label: string
  /** Positive decimal string. */
  amount: string
}

export type ParsedPayslip = {
  kind: "PAYSLIP"
  fileType: "PAYSLIP_PDF" | "CONTRACTOR_FEE_PDF"
  payslipKind: "SALARY" | "CONTRACTOR_FEE"
  employer: string
  /** First day of the statement month, ISO yyyy-MM-dd. */
  periodMonth: string
  grossEarnings: string
  totalDeductions: string
  netPay: string
  earnings: PayslipLineItem[]
  deductions: PayslipLineItem[]
  /** Designation, days payable, leave balances, contractor id, … (strings). */
  meta?: Record<string, string>
  /** Account number the slip says the payout goes to, when printed. */
  bankAccountNumber?: string
}

export type ParseResult = ParsedStatement | ParsedPayslip

/** Thrown by parsers when the file doesn't match their expected shape. */
export class StatementParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StatementParseError"
  }
}
