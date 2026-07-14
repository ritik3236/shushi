import { createHash } from "node:crypto"

import type { ParsedTransaction } from "@/lib/imports/types"

// Idempotent-import machinery. A transaction's identity is
// (account, date, direction, amount, normalized narration, occurrence):
// re-uploading the same or an overlapping statement can't duplicate rows, while
// genuinely identical same-day transactions (occurrence 1, 2, …) still import.
// Statements list rows in a stable order, so occurrence numbering is stable
// across overlapping files.

export function normalizeNarrationKey(narration: string): string {
  return narration.replace(/\s+/g, " ").trim().toUpperCase()
}

export type OccurrenceRow<T extends ParsedTransaction> = T & { occurrence: number }

/** Number identical rows within one statement in file order (1-based). */
export function assignOccurrences<T extends ParsedTransaction>(rows: T[]): OccurrenceRow<T>[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const identity = [
      row.date,
      row.direction,
      row.amount,
      normalizeNarrationKey(row.narration),
    ].join("|")
    const occurrence = (seen.get(identity) ?? 0) + 1
    seen.set(identity, occurrence)
    return { ...row, occurrence }
  })
}

/** Content hash stored on the row; unique per account via the DB constraint. */
export function buildDedupeKey(row: {
  date: string
  direction: "DEBIT" | "CREDIT"
  amount: string
  narration: string
  occurrence: number
}): string {
  return createHash("sha256")
    .update(
      [
        row.date,
        row.direction,
        row.amount,
        normalizeNarrationKey(row.narration),
        String(row.occurrence),
      ].join("|")
    )
    .digest("hex")
}

/** sha256 of a whole file, for exact re-upload warnings. */
export function hashFile(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}
