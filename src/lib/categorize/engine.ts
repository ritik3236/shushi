import type { RuleField, RuleMatch, TxDirection } from "@prisma/client"

// Pure rule-matching engine: first matching rule (by ascending priority, then
// insertion order) wins. Rules never crash a run — a bad regex is skipped.

export type MatchableRule = {
  id: string
  pattern: string
  field: RuleField
  match: RuleMatch
  direction: TxDirection | null
  categoryId: string
  priority: number
}

export type MatchableTransaction = {
  narration: string
  counterparty?: string | null
  direction: TxDirection
}

export function matchCategory(
  rules: MatchableRule[],
  tx: MatchableTransaction
): string | null {
  const ordered = [...rules].sort((a, b) => a.priority - b.priority)
  for (const rule of ordered) {
    if (rule.direction && rule.direction !== tx.direction) continue
    const haystack = rule.field === "COUNTERPARTY" ? tx.counterparty : tx.narration
    if (!haystack) continue
    if (rule.match === "CONTAINS") {
      if (haystack.toUpperCase().includes(rule.pattern.toUpperCase())) return rule.categoryId
    } else {
      try {
        if (new RegExp(rule.pattern, "i").test(haystack)) return rule.categoryId
      } catch {
        // Invalid user regex — skip the rule rather than failing the import.
      }
    }
  }
  return null
}
