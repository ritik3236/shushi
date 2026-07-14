import { DateTime } from "luxon"

// Period math shared by the dashboard. Three modes over the same monthly grain:
//   MONTH — a single calendar month ('2026-07')
//   YEAR  — a calendar year ('2026' → Jan–Dec 2026)
//   FY    — an Indian financial year, keyed by its START year ('2026' → Apr 2026–Mar 2027)

export type PeriodMode = "MONTH" | "YEAR" | "FY"

export const PERIOD_MODES: PeriodMode[] = ["MONTH", "YEAR", "FY"]

/** Financial-year start year for a 'YYYY-MM' month: Jan–Mar belong to the prior FY. */
export function fyStartYear(month: string): number {
  const [year, mon] = month.split("-").map(Number)
  return mon >= 4 ? year : year - 1
}

/** 'FY 2026-27' from a start year. */
export function fyLabel(startYear: number): string {
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`
}

/** The 'YYYY-MM' months a period key covers, oldest→newest. */
export function monthsInPeriod(mode: PeriodMode, key: string): string[] {
  if (mode === "MONTH") return [key]
  if (mode === "YEAR") {
    const year = Number(key)
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`)
  }
  // FY: Apr(start) … Mar(start+1)
  const start = DateTime.fromObject({ year: Number(key), month: 4 })
  return Array.from({ length: 12 }, (_, i) => start.plus({ months: i }).toFormat("yyyy-MM"))
}

/**
 * The month window to chart for a period: the period's own months for YEAR/FY,
 * or the trailing 6 months ending at the selected month for MONTH mode.
 */
export function chartMonths(mode: PeriodMode, key: string): string[] {
  if (mode === "MONTH") {
    const end = DateTime.fromFormat(key, "yyyy-MM").minus({ months: 5 })
    return Array.from({ length: 6 }, (_, i) => end.plus({ months: i }).toFormat("yyyy-MM"))
  }
  return monthsInPeriod(mode, key)
}

/** Human label for a selected period. */
export function periodLabel(mode: PeriodMode, key: string): string {
  if (mode === "MONTH") return DateTime.fromFormat(key, "yyyy-MM").toFormat("LLL yyyy")
  if (mode === "YEAR") return key
  return fyLabel(Number(key))
}

/** Short axis label for a month within a chart. */
export function monthAxisLabel(month: string): string {
  return DateTime.fromFormat(month, "yyyy-MM").toFormat("LLL")
}

/** Derive the available period keys (newest first) from the months that have data. */
export function availablePeriods(months: string[]): {
  months: string[]
  years: string[]
  financialYears: string[]
} {
  const sorted = [...new Set(months)].sort().reverse()
  const years = [...new Set(sorted.map((m) => m.split("-")[0]))].sort().reverse()
  const financialYears = [...new Set(sorted.map((m) => String(fyStartYear(m))))].sort().reverse()
  return { months: sorted, years, financialYears }
}

/** Resolve the effective selected key for a mode, clamped to what's available. */
export function resolveSelected(
  mode: PeriodMode,
  requested: string | undefined,
  available: { months: string[]; years: string[]; financialYears: string[] }
): string | null {
  const pool =
    mode === "MONTH" ? available.months : mode === "YEAR" ? available.years : available.financialYears
  if (!pool.length) return null
  return requested && pool.includes(requested) ? requested : pool[0]
}
