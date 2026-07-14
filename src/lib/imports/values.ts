import { DateTime } from "luxon"

// Shared low-level value parsing for statement parsers. Keep this dependency-
// light: string/number in, normalized string out.

export type ParsedAmount = {
  /** Positive decimal string with exactly two fraction digits. */
  value: string
  negative: boolean
}

/**
 * Parse an Indian-formatted amount: "1,87,831.61", "₹ -1,87,831.61", " 186.00",
 * 187831.61 → { value: "187831.61", negative }. Returns null for blanks,
 * placeholders ("-", "") and non-numeric junk.
 */
export function parseAmount(raw: string | number | null | undefined): ParsedAmount | null {
  if (raw == null) return null
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null
    return { value: Math.abs(raw).toFixed(2), negative: raw < 0 }
  }
  const cleaned = raw.replace(/[₹,\s]/g, "")
  if (!cleaned || cleaned === "-" || cleaned === "--") return null
  const negative = cleaned.startsWith("-")
  const magnitude = cleaned.replace(/^-/, "")
  if (!/^\d+(\.\d+)?$/.test(magnitude)) return null
  const [int, frac = ""] = magnitude.split(".")
  return { value: `${int}.${`${frac}00`.slice(0, 2)}`, negative }
}

/** Parse with a Luxon format string → ISO yyyy-MM-dd, or null. */
export function isoDate(raw: string | null | undefined, format: string): string | null {
  if (!raw) return null
  const dt = DateTime.fromFormat(raw.trim(), format)
  return dt.isValid ? dt.toISODate() : null
}

/** Excel serial date (1900 system) → ISO yyyy-MM-dd, or null. */
export function isoFromExcelSerial(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null
  const dt = DateTime.fromMillis(Math.round((serial - 25569) * 86400 * 1000), { zone: "utc" })
  return dt.isValid ? dt.toISODate() : null
}

/** Collapse runs of whitespace (incl. newlines) into single spaces and trim. */
export function normalizeWhitespace(raw: string): string {
  return raw.replace(/\s+/g, " ").trim()
}
