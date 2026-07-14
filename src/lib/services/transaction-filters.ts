import "server-only"

import { listAccountOptions } from "@/lib/services/analytics"
import { getCategoryOptions, type CategoryOption } from "@/lib/services/categories"
import { readFilterOptions, writeFilterOptions } from "@/lib/services/filter-options-cache"
import { listAllTags, listTransactionMonths } from "@/lib/services/transactions"

// The transactions filter dropdowns (months, categories, accounts, tags) barely
// change — but re-fetching all four on every navigation was ~3s of the page's
// query time (they contend on the far, tiny compute). Cache them per user with
// a short TTL (guideline §5: an in-request-scope module Map, since the data
// depends on the session). Only the actual transaction query runs per nav.
//
// Mutations that change these (import commit, tag edit) call
// invalidateFilterOptions (from filter-options-cache) so the change shows
// immediately; the TTL is a backstop.

export type TransactionFilterOptions = {
  months: string[]
  categories: CategoryOption[]
  accounts: { id: string; name: string }[]
  tags: { tag: string; count: number }[]
}

export async function getTransactionFilterOptions(
  userId: string
): Promise<TransactionFilterOptions> {
  const cached = readFilterOptions<TransactionFilterOptions>(userId)
  if (cached) return cached

  // Sequential, not Promise.all: parallel queries contend on the far, tiny
  // compute and come back ~2× slower. Only runs on a cache miss anyway.
  const months = await listTransactionMonths(userId)
  const categories = await getCategoryOptions(userId)
  const accounts = await listAccountOptions(userId)
  const tags = await listAllTags(userId)
  const value: TransactionFilterOptions = { months, categories, accounts, tags }
  writeFilterOptions(userId, value)
  return value
}
