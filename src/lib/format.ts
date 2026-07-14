import { DateTime } from "luxon"

import { APP_TIMEZONE } from "@/lib/constants"

// The single formatting seam: every date and amount the UI renders goes
// through here. Money travels as decimal strings (Prisma Decimal → string) and
// is only converted to Number for display — never for arithmetic.

/** "₹1,87,831.61" / "₹500" — Indian digit grouping, paise only when present. */
export function formatINR(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return "—"
  const hasPaise = Math.round(n * 100) % 100 !== 0
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n)
}

/** Signed variant for transaction rows: "+₹2,600" / "−₹706.82". */
export function formatSignedINR(value: string | number, direction: "DEBIT" | "CREDIT"): string {
  const formatted = formatINR(value)
  return direction === "CREDIT" ? `+${formatted}` : `−${formatted}`
}

/** "1.2L" / "45k" compact form for chart axes. */
export function formatINRCompact(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return "—"
  const abs = Math.abs(n)
  if (abs >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(1).replace(/\.0$/, "")}Cr`
  if (abs >= 1_00_000) return `${(n / 1_00_000).toFixed(1).replace(/\.0$/, "")}L`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`
  return String(Math.round(n))
}

function toDateTime(value: Date | string): DateTime {
  const dt =
    typeof value === "string"
      ? DateTime.fromISO(value, { zone: APP_TIMEZONE })
      : DateTime.fromJSDate(value, { zone: "utc" })
  return dt
}

/** "04 Apr 2026" */
export function formatDate(value: Date | string): string {
  return toDateTime(value).toFormat("dd LLL yyyy")
}

/** "Apr 2026" */
export function formatMonth(value: Date | string): string {
  return toDateTime(value).toFormat("LLL yyyy")
}

/** "04 Apr" — for dense lists where the year is contextual. */
export function formatDayMonth(value: Date | string): string {
  return toDateTime(value).toFormat("dd LLL")
}
