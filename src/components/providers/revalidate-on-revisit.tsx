"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

// Stale-while-revalidate. The Router Cache (staleTimes.dynamic) repaints a
// recently-seen page INSTANTLY but serves it stale and never revalidates. This
// fires ONE router.refresh() on a genuine cache-hit revisit (seen within the
// window) so the stale page swaps to fresh silently — "instant but current".
//
// The guard matters: refreshing on every mount double-fetches (a first visit is
// already fresh; a post-expiry revisit was already refetched by Next). Keyed by
// path+query so each list/filter state tracks its own window.
const STALE_MS = 30_000 // mirror next.config staleTimes.dynamic
const lastSeen = new Map<string, number>() // module-level; resets on full reload

export function RevalidateOnRevisit() {
  const key = usePathname() + "?" + useSearchParams().toString()
  const router = useRouter()
  useEffect(() => {
    const prev = lastSeen.get(key)
    const now = Date.now()
    lastSeen.set(key, now)
    if (prev != null && now - prev < STALE_MS) router.refresh()
  }, [key, router])
  return null
}
