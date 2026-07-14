"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MoreHorizontal } from "lucide-react"

import { AnimatedNavIcon } from "@/components/layout/animated-nav-icon"
import { NAV_ITEMS } from "@/components/layout/nav"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

// Thumb-zone primary navigation for phones/tablets. A bottom tab bar for the
// first few destinations; the rest collapse into a "More" bottom sheet so the
// bar never crowds. Hidden at lg+, where the sidebar takes over.
const MAX_TABS = 4

const tabClass =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 pt-1.5 pb-1 transition-colors focus-visible:outline-none"

export function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const hasOverflow = NAV_ITEMS.length > 5
  const primary = hasOverflow ? NAV_ITEMS.slice(0, MAX_TABS) : NAV_ITEMS
  const overflow = hasOverflow ? NAV_ITEMS.slice(MAX_TABS) : []
  const overflowActive = overflow.some((item) => isActive(item.href))

  return (
    <nav
      aria-label="Primary"
      className="bg-background/90 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {primary.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              aria-current={active ? "page" : undefined}
              className={cn(tabClass, active ? "text-primary" : "text-muted-foreground")}
            >
              <AnimatedNavIcon icon={item.icon} active={active} className="size-5 shrink-0" />
              <span className="text-[11px] leading-none font-medium">{item.label}</span>
            </Link>
          )
        })}

        {overflow.length > 0 && (
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="More"
                className={cn(tabClass, overflowActive ? "text-primary" : "text-muted-foreground")}
              >
                <MoreHorizontal className="size-5 shrink-0" />
                <span className="text-[11px] leading-none font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-2 px-4 pb-2">
                {overflow.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-colors",
                        active
                          ? "border-primary/40 bg-primary/5 text-primary"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="text-xs font-medium">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </nav>
  )
}
