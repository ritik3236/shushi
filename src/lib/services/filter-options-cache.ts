import "server-only"

// Standalone cache primitives for the transactions filter options, kept in
// their own module (importing nothing) so mutation services can invalidate
// without a circular import back to transaction-filters.ts.

type Cached<T> = { at: number; value: T }

const store = new Map<string, Cached<unknown>>()
const TTL_MS = 60_000

export function readFilterOptions<T>(userId: string): T | null {
  const hit = store.get(userId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T
  return null
}

export function writeFilterOptions<T>(userId: string, value: T): void {
  store.set(userId, { at: Date.now(), value })
}

/** Drop a user's cached filter options after a mutation that changes them. */
export function invalidateFilterOptions(userId: string): void {
  store.delete(userId)
}
