import { extractText, getDocumentProxy } from "unpdf"

import { StatementParseError } from "@/lib/imports/types"
import type { ParsedPayslip, PayslipLineItem } from "@/lib/imports/types"
import { isoDate, normalizeWhitespace, parseAmount } from "@/lib/imports/values"

// BizDaddy issues two PDF formats: monthly salary payslips ("PAYSLIP - <Month>
// <Year>") and contractor fee statements ("MONTHLY PROFESSIONAL FEE STATEMENT").
// The extracted text layer carries no reliable line breaks, so both formats are
// parsed as a flat token stream anchored on labels, never on positions.

const EMPLOYER = "BizDaddy"

const AMOUNT_TOKEN = /^\d[\d,]*(?:\.\d+)?$/

// Labels that belong to the DEDUCTIONS column of the salary table. The two
// columns interleave in the flattened text, so this set is the only way to
// route a pair to the right side; sums are verified against the printed totals.
const SALARY_DEDUCTION_LABELS = new Set(["lop", "advance salary"])

function toMoney(raw: string, what: string): string {
  const parsed = parseAmount(raw)
  if (!parsed || parsed.negative) {
    throw new StatementParseError(`Payslip PDF: unreadable amount "${raw}" for ${what}`)
  }
  return parsed.value
}

function paise(money: string): number {
  return Math.round(Number(money) * 100)
}

function moneyFromPaise(total: number): string {
  return (total / 100).toFixed(2)
}

function sumPaise(items: PayslipLineItem[]): number {
  return items.reduce((total, item) => total + paise(item.amount), 0)
}

/** Split a "<label> <amount> <label> <amount> …" token stream into pairs. */
function labelAmountPairs(segment: string, what: string): PayslipLineItem[] {
  const tokens = normalizeWhitespace(segment).split(" ").filter(Boolean)
  const items: PayslipLineItem[] = []
  let labelWords: string[] = []
  for (const token of tokens) {
    if (AMOUNT_TOKEN.test(token)) {
      if (labelWords.length === 0) {
        throw new StatementParseError(`Payslip PDF: amount "${token}" without a label in ${what}`)
      }
      items.push({ label: labelWords.join(" "), amount: toMoney(token, what) })
      labelWords = []
    } else {
      labelWords.push(token)
    }
  }
  if (labelWords.length > 0) {
    throw new StatementParseError(`Payslip PDF: label "${labelWords.join(" ")}" without an amount in ${what}`)
  }
  return items
}

function parseSalary(text: string): ParsedPayslip {
  const periodMonth = isoDate(text.match(/PAYSLIP - ([A-Za-z]+ \d{4})/)?.[1], "MMMM yyyy")
  if (!periodMonth) {
    throw new StatementParseError("Salary payslip: could not read the month from the PAYSLIP title")
  }

  const bankSegment = text.match(/Bank Account\b([\s\S]*?)SALARY DETAILS/)?.[1]
  const bankAccountNumber = bankSegment?.match(/\d{15,}/)?.[0]

  const table = text.match(
    /EARNINGS AMOUNT \(INR\) DEDUCTIONS AMOUNT \(INR\)([\s\S]*?)Total Earnings \(A\) ([\d,.]+) Total Deductions \(B\) ([\d,.]+)/,
  )
  if (!table) {
    throw new StatementParseError("Salary payslip: EARNINGS/DEDUCTIONS table not found")
  }
  const earnings: PayslipLineItem[] = []
  const deductions: PayslipLineItem[] = []
  for (const item of labelAmountPairs(table[1], "the EARNINGS/DEDUCTIONS table")) {
    const target = SALARY_DEDUCTION_LABELS.has(item.label.toLowerCase()) ? deductions : earnings
    target.push(item)
  }
  const grossEarnings = toMoney(table[2], "Total Earnings (A)")
  const totalDeductions = toMoney(table[3], "Total Deductions (B)")
  // The earnings/deductions split relies on SALARY_DEDUCTION_LABELS; the
  // printed totals are the ground truth that the split was correct.
  if (sumPaise(earnings) !== paise(grossEarnings)) {
    throw new StatementParseError("Salary payslip: earnings items do not add up to Total Earnings (A)")
  }
  if (sumPaise(deductions) !== paise(totalDeductions)) {
    throw new StatementParseError("Salary payslip: deduction items do not add up to Total Deductions (B)")
  }

  const netRaw = text.match(/Net Pay (NIL|[\d,]+(?:\.\d+)?)/)?.[1]
  if (!netRaw) {
    throw new StatementParseError("Salary payslip: Net Pay not found")
  }
  const netPay = netRaw === "NIL" ? "0.00" : toMoney(netRaw, "Net Pay")

  const meta: Record<string, string> = {}
  // Fixed header row: label row then value row; department is one word here.
  const employee = text.match(
    /Employee Number Date Joined Department Designation (\d+) \d{1,2} [A-Za-z]+ \d{4} (\S+) (.+?) Payment Mode/,
  )
  if (employee) {
    meta.employeeNumber = employee[1]
    meta.department = employee[2]
    meta.designation = employee[3]
  }
  const days = text.match(/DAYS PAYABLE ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)/)
  if (days) {
    meta.totalWorkingDays = days[2]
    meta.lossOfPayDays = days[3]
    meta.daysPayable = days[4]
  }

  return {
    kind: "PAYSLIP",
    fileType: "PAYSLIP_PDF",
    payslipKind: "SALARY",
    employer: EMPLOYER,
    periodMonth,
    grossEarnings,
    totalDeductions,
    netPay,
    earnings,
    deductions,
    meta,
    bankAccountNumber,
  }
}

function parseContractorFee(text: string): ParsedPayslip {
  const periodMonth = isoDate(text.match(/Statement Month: ([A-Za-z]+ \d{4})/)?.[1], "MMMM yyyy")
  if (!periodMonth) {
    throw new StatementParseError("Contractor fee statement: could not read the Statement Month")
  }

  const feeTable = text.match(/Description Amount \(INR\)([\s\S]*?)Gross Amount ([\d,]+(?:\.\d+)?)/)
  if (!feeTable) {
    throw new StatementParseError("Contractor fee statement: fee table with Gross Amount not found")
  }
  const earnings = labelAmountPairs(feeTable[1], "the fee table").filter(
    (item) => paise(item.amount) !== 0,
  )
  const grossEarnings = toMoney(feeTable[2], "Gross Amount")

  const deductions: PayslipLineItem[] = []
  for (const match of text.matchAll(/Less: ([A-Za-z][A-Za-z -]*?) ([\d,]+(?:\.\d+)?)/g)) {
    const amount = toMoney(match[2], `deduction "${match[1]}"`)
    if (paise(amount) !== 0) deductions.push({ label: match[1], amount })
  }

  const netRaw = text.match(/Net Amount Payable ([\d,]+(?:\.\d+)?)/)?.[1]
  if (!netRaw) {
    throw new StatementParseError("Contractor fee statement: Net Amount Payable not found")
  }

  const meta: Record<string, string> = {}
  const contractorId = text.match(/Contractor ID (\S+)/)?.[1]
  if (contractorId) meta.contractorId = contractorId
  const billable = text.match(/Billable Service Days: ([\d.]+)/)?.[1]
  if (billable) meta.billableServiceDays = billable
  const nonBillable = text.match(/Non-Billable Days: ([\d.]+)/)?.[1]
  if (nonBillable) meta.nonBillableDays = nonBillable

  return {
    kind: "PAYSLIP",
    fileType: "CONTRACTOR_FEE_PDF",
    payslipKind: "CONTRACTOR_FEE",
    employer: EMPLOYER,
    periodMonth,
    grossEarnings,
    totalDeductions: moneyFromPaise(sumPaise(deductions)),
    netPay: toMoney(netRaw, "Net Amount Payable"),
    earnings,
    deductions,
    meta,
  }
}

export async function parsePayslipPdf(buffer: Buffer): Promise<ParsedPayslip> {
  let text: string
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    text = (await extractText(pdf, { mergePages: true })).text
  } catch {
    throw new StatementParseError("Payslip PDF: file is not a readable PDF")
  }
  const flat = normalizeWhitespace(text)
  if (flat.includes("MONTHLY PROFESSIONAL FEE STATEMENT")) return parseContractorFee(flat)
  if (/PAYSLIP - [A-Za-z]+ \d{4}/.test(flat)) return parseSalary(flat)
  throw new StatementParseError("Payslip PDF: neither a BizDaddy payslip nor a contractor fee statement")
}
