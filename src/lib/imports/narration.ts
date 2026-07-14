import { normalizeWhitespace } from "@/lib/imports/values"
import type { ImportFileType } from "@/lib/imports/types"

// Enriches raw statement narrations with a payment channel and a counterparty.
// Best-effort by construction: anything unrecognized falls back to OTHER with
// no counterparty — never throw over a weird narration.

export type NarrationInfo = {
  /** UPI_P2M | UPI_P2A | UPI | IMPS | NEFT | ACH | FT | POS | ATM | CARD | INTEREST | FEE | CC | CC_PAYMENT | CASHBACK | OTHER */
  channel: string
  counterparty?: string
  /** UPI/IMPS reference embedded in the narration, when present. */
  upiRef?: string
}

const CC_FEE_PATTERNS = /^(gst|foreign currency transaction fee|debit interest|interest charges|late payment)/i

function cleanName(raw: string): string | undefined {
  const name = normalizeWhitespace(raw)
  if (!name || name === "-") return undefined
  return name
}

/** Axis savings narrations are slash-separated: UPI/P2M/<ref>/<name>/<...>. */
function parseAxisNarration(narration: string): NarrationInfo {
  const upi = narration.match(/^UPI\/(P2M|P2A)\/(\d+)\/([^/]+)/i)
  if (upi) {
    return {
      channel: `UPI_${upi[1].toUpperCase()}`,
      upiRef: upi[2],
      counterparty: cleanName(upi[3]),
    }
  }
  const imps = narration.match(/^IMPS\/\w+\/(\d+)\/([^/]+)/i)
  if (imps) {
    return { channel: "IMPS", upiRef: imps[1], counterparty: cleanName(imps[2]) }
  }
  if (/^SB:.*Int\.Pd/i.test(narration)) {
    return { channel: "INTEREST" }
  }
  if (/^BRN-PYMT-CARD/i.test(narration)) {
    return { channel: "CARD", counterparty: "Card payment" }
  }
  if (/Int\.Coll/i.test(narration)) {
    return { channel: "FEE" }
  }
  return { channel: "OTHER" }
}

/** HDFC savings narrations are dash-separated: UPI-<NAME>-<vpa>-<ifsc>-<ref>-<remark>. */
function parseHdfcNarration(narration: string): NarrationInfo {
  const upi = narration.match(/^UPI-([^-]+)-/i)
  if (upi) {
    const ref = narration.match(/-(\d{9,})/)
    return {
      channel: "UPI",
      counterparty: cleanName(upi[1]),
      upiRef: ref ? ref[1] : undefined,
    }
  }
  const ach = narration.match(/^ACH\s+[DC]-\s*([^-]+)/i)
  if (ach) {
    return { channel: "ACH", counterparty: cleanName(ach[1]) }
  }
  const ft = narration.match(/^FT\s*-\s*(?:CR|DR)\s*-\s*[\dXx*]+\s*-\s*(.+)$/i)
  if (ft) {
    return { channel: "FT", counterparty: cleanName(ft[1]) }
  }
  const imps = narration.match(/^IMPS-(?:\d+-)?([^-]+)/i)
  if (imps) {
    return { channel: "IMPS", counterparty: cleanName(imps[1]) }
  }
  if (/^POS\b/i.test(narration)) {
    const pos = narration.match(/^POS\s+[\dXx*]*\s*(.*)$/i)
    return { channel: "POS", counterparty: pos ? cleanName(pos[1]) : undefined }
  }
  const neft = narration.match(/^NEFT\s*(?:CR|DR)?[-\s]+\w*[-\s]*([A-Za-z][^-]*)/i)
  if (neft) {
    return { channel: "NEFT", counterparty: cleanName(neft[1]) }
  }
  if (/^(ATM|EAW|NWD)[-\s]/i.test(narration) || /CASH WDL/i.test(narration)) {
    return { channel: "ATM", counterparty: "Cash withdrawal" }
  }
  if (/^INT(EREST)?\.?\s*(PD|PAID)/i.test(narration) || /CREDIT INTEREST/i.test(narration)) {
    return { channel: "INTEREST" }
  }
  return { channel: "OTHER" }
}

/** GPay rows carry a clean name: "Paid to X" / "Received from X" / "Self transfer to X". */
function parseGpayNarration(narration: string): NarrationInfo {
  const self = narration.match(/^Self transfer (?:to|from) (.+)$/i)
  if (self) return { channel: "SELF_TRANSFER", counterparty: cleanName(self[1]) }
  const m = narration.match(/^(?:Paid to|Received from) (.+)$/i)
  return { channel: "UPI", counterparty: m ? cleanName(m[1]) : undefined }
}

/** Credit-card rows: "MERCHANT,CITY" details, plus payments/fees/cashback. */
function parseCcNarration(narration: string): NarrationInfo {
  if (/^(MB|NEFT|UPI|IMPS)\s+PAYMENT\b/i.test(narration) || /PAYMENT RECEIVED/i.test(narration)) {
    return { channel: "CC_PAYMENT", counterparty: "Card payment" }
  }
  if (/^Cashback credit/i.test(narration)) {
    return { channel: "CASHBACK", counterparty: "Cashback" }
  }
  if (CC_FEE_PATTERNS.test(narration)) {
    return { channel: "FEE", counterparty: cleanName(narration) }
  }
  // "BUNDL TECHNOLOGIES,BENGALURU" → merchant before the trailing city segment.
  const lastComma = narration.lastIndexOf(",")
  const merchant = lastComma > 0 ? narration.slice(0, lastComma) : narration
  return { channel: "CC", counterparty: cleanName(merchant) }
}

export function parseNarration(
  narration: string,
  fileType: ImportFileType
): NarrationInfo {
  const text = normalizeWhitespace(narration)
  switch (fileType) {
    case "AXIS_SAVINGS_CSV":
      return parseAxisNarration(text)
    case "HDFC_SAVINGS_XLS":
      return parseHdfcNarration(text)
    case "AXIS_CC_XLSX":
      return parseCcNarration(text)
    case "GPAY_STATEMENT_PDF":
      return parseGpayNarration(text)
    default:
      return { channel: "OTHER" }
  }
}
