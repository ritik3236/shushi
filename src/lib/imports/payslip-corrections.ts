// Known BizDaddy payslip header typos. A slip's "PAYSLIP - <Month> <Year>"
// header sometimes prints the wrong month, and the parser (correctly) trusts the
// header — so the true month is pinned here, per the user's FY2025-26
// reconciliation sheet. Pure data + lookup so it can be unit-tested and reused by
// both the import preview and the commit path.
//
// Keyed by `employer|headerMonth(YYYY-MM)|gross` so a correction targets the one
// defective slip and can never hit a genuine same-month slip (which has a
// different gross).

const PERIOD_MONTH_OVERRIDES: Record<string, string> = {
  // Sep'25 slip prints "August 2025"; it is September (gross 1,29,972 vs the real
  // Aug Revised slip's 1,29,533). Its net credit landed 03-10-2025.
  "BizDaddy|2025-08|129972.00": "2025-09-01",
}

/** The slip's true period month (ISO yyyy-MM-dd), applying header-typo fixes. */
export function correctedPeriodMonth(parsed: {
  employer: string
  periodMonth: string
  grossEarnings: string
}): string {
  const key = `${parsed.employer}|${parsed.periodMonth.slice(0, 7)}|${parsed.grossEarnings}`
  return PERIOD_MONTH_OVERRIDES[key] ?? parsed.periodMonth
}
