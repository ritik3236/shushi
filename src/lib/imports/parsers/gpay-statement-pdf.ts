import { type ParsedStatement, type ParsedTransaction, StatementParseError } from "@/lib/imports/types"
import { isoDate, normalizeWhitespace, parseAmount } from "@/lib/imports/values"

// Google Pay "Transaction statement" (PDF). Unlike a bank statement it is not a
// single account: every row names the funding account ("Paid by Axis Bank 5665",
// "UPI Lite | Axis Bank 5665", "HDFC Bank 2791", "Union Bank of India 0003") and
// carries the shared UPI Transaction ID.
//
// The Axis/HDFC rows already live in those banks' own statements (same UPI ref →
// importing them here would duplicate), and UPI Lite spends net out against the
// Axis top-ups. So this parser intentionally keeps ONLY the Union Bank account —
// the one with no bank statement of its own — and drops every other source.
//
// The extracted text layer has no line breaks, so rows are recovered from the
// flattened stream by splitting on the "<date> <time>" boundary that begins each
// one. Three row shapes:
//   Paid to <name> UPI Transaction ID: <id> Paid by <account> ₹<amt>      → debit
//   Received from <name> UPI Transaction ID: <id> Paid to <account> ₹<amt> → credit
//   Self transfer to <account> UPI Transaction ID: <id> Paid by <account> ₹<amt>

const TARGET_BANK = /union bank of india/i
const DATE_FORMAT = "d LLL, yyyy" // "02 Jan, 2026"

const isUnionBank = (s: string) => TARGET_BANK.test(s)

/** Does this text look like a Google Pay transaction statement? */
export function isGpayStatement(text: string): boolean {
  const flat = normalizeWhitespace(text)
  return /Google Pay app/i.test(flat) && /Transaction statement/i.test(flat)
}

// Strip the header/footer that repeats on every page, then collapse whitespace.
function cleanText(text: string): string {
  return text
    .replace(/Transaction statement\s+\S+, \S+@\S+/g, " ")
    .replace(/Note: This statement reflects[\s\S]*?show up in this statement\./g, " ")
    .replace(/Page \d+ of \d+/g, " ")
    .replace(/Date & time Transaction details Amount/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const BOUNDARY = /(\d{1,2} [A-Z][a-z]{2}, \d{4} \d{1,2}:\d{2} [AP]M)/g
const ROW =
  /^(Paid to|Received from|Self transfer to) (.+?) UPI Transaction ID: (\w+) (Paid by|Paid to) (.+?) ₹([\d,]+(?:\.\d{1,2})?)$/

type Classified = { direction: "DEBIT" | "CREDIT"; narration: string }

/**
 * Decide whether a row touches the Union Bank account and, if so, from which
 * side. Returns null for every other funding source.
 */
function classify(verb: string, name: string, acct: string): Classified | null {
  if (verb === "Paid to") {
    return isUnionBank(acct) ? { direction: "DEBIT", narration: `Paid to ${name}` } : null
  }
  if (verb === "Received from") {
    return isUnionBank(acct) ? { direction: "CREDIT", narration: `Received from ${name}` } : null
  }
  // Self transfer: money leaves `acct` (source) and enters `name` (destination).
  if (isUnionBank(acct)) return { direction: "DEBIT", narration: `Self transfer to ${name}` }
  if (isUnionBank(name)) return { direction: "CREDIT", narration: `Self transfer from ${acct}` }
  return null
}

function statementPeriod(text: string): { start?: string; end?: string } {
  const m = text.match(
    /period\s+(\d{1,2} [A-Z][a-z]+ \d{4})\s*-\s*(\d{1,2} [A-Z][a-z]+ \d{4})/
  )
  if (!m) return {}
  const start = isoDate(m[1], "d LLLL yyyy") ?? undefined
  const end = isoDate(m[2], "d LLLL yyyy") ?? undefined
  return { start, end }
}

export function parseGpayStatement(text: string): ParsedStatement {
  if (!isGpayStatement(text)) {
    throw new StatementParseError("GPay statement: not a Google Pay transaction statement")
  }
  const clean = cleanText(text)

  // Split into blocks at each "<date> <time>" marker; parts alternate
  // [marker, body, marker, body, …].
  const parts = clean.split(BOUNDARY)
  const transactions: ParsedTransaction[] = []
  for (let i = 1; i < parts.length; i += 2) {
    const marker = parts[i].trim()
    const body = (parts[i + 1] ?? "").trim()
    const row = body.match(ROW)
    if (!row) continue // Top-up to UPI Lite and any non-transaction line
    const [, verb, name, upiId, , acct, rawAmount] = row

    const hit = classify(verb, name.trim(), acct.trim())
    if (!hit) continue // funded by a non-Union-Bank account → skip

    const date = isoDate(marker.replace(/ \d{1,2}:\d{2} [AP]M$/, ""), DATE_FORMAT)
    if (!date) throw new StatementParseError(`GPay statement: unreadable date "${marker}"`)
    const amount = parseAmount(rawAmount)
    if (!amount) throw new StatementParseError(`GPay statement: unreadable amount "${rawAmount}"`)

    transactions.push({
      date,
      narration: hit.narration,
      refNo: upiId,
      amount: amount.value,
      direction: hit.direction,
    })
  }

  if (transactions.length === 0) {
    throw new StatementParseError("GPay statement: no Union Bank transactions found")
  }

  const dates = transactions.map((t) => t.date).sort()
  const period = statementPeriod(clean)

  return {
    kind: "STATEMENT",
    fileType: "GPAY_STATEMENT_PDF",
    account: {
      bank: "Union Bank of India",
      // GPay only prints the last 4 digits; synthetic-but-stable id for the
      // account so re-uploads reconcile. (A full Union Bank statement, if ever
      // imported, would use the real number and not auto-merge.)
      accountNumber: "UNIONBANK-0003",
      type: "SAVINGS",
      name: "Union Bank of India Savings",
    },
    periodStart: period.start ?? dates[0],
    periodEnd: period.end ?? dates[dates.length - 1],
    transactions,
  }
}
