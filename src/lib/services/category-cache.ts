import "server-only"

// Per-user cache for the categories page data (tree + options + rules), which
// changes only on category/rule CRUD. Standalone module (imports nothing) so
// mutation services in either categories.ts or transactions.ts can invalidate
// without a circular import.

type Cached<T> = { at: number; value: T }

const store = new Map<string, Cached<unknown>>()
const TTL_MS = 60_000

export function readCategoryData<T>(userId: string): T | null {
  const hit = store.get(userId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T
  return null
}

export function writeCategoryData<T>(userId: string, value: T): void {
  store.set(userId, { at: Date.now(), value })
}

export function invalidateCategoryData(userId: string): void {
  store.delete(userId)
}
