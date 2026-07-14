"use client"

import { usePathname } from "next/navigation"

import { PageContainer } from "@/components/layout/page-container"

// The shell forces no layout on a page. Most pages want the default padded,
// centered column; the transactions ledger owns its own full-bleed layout (its
// own padding, its own sticky header). Adding a page here is how a route opts out
// of the default — no negative-margin escapes from a container it didn't choose.
const FULL_BLEED = ["/transactions"]

export function PageFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Full-bleed pages own their own scroll region (fixed toolbar + scrolling list).
  if (FULL_BLEED.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return <div className="h-full">{children}</div>
  }
  // Everything else scrolls as one padded column inside the bounded main.
  return (
    <div className="h-full overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+4.5rem)] lg:pb-0">
      <PageContainer>{children}</PageContainer>
    </div>
  )
}
