"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@neondatabase/auth-ui"

import { AnimatedNavIcon } from "@/components/layout/animated-nav-icon"
import { BottomNav } from "@/components/layout/bottom-nav"
import { NAV_ITEMS } from "@/components/layout/nav"
import { ShushiLogo } from "@/components/brand/shushi-logo"
import { APP_NAME } from "@/lib/constants"
import { cn } from "@/lib/utils"

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-2">
      <ShushiLogo className="size-7" />
      <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
    </Link>
  )
}

// The shell owns chrome only — a pinned sidebar and a mobile top/bottom bar. The
// document itself scrolls (no nested overflow container), and each page owns its
// own width and padding via <PageContainer> so it can go full-bleed when it wants.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop sidebar — fixed chrome; never scrolls with page content. */}
      <aside className="bg-sidebar border-sidebar-border hidden w-56 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-14 items-center px-2">
          <Brand />
        </div>
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
          {NAV_ITEMS.map(({ href, label, icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                  "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <AnimatedNavIcon icon={icon} active={active} className="size-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="border-sidebar-border flex items-center gap-2 border-t p-3">
          <UserButton size="icon" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbar — brand + account; navigation lives in the bottom bar. */}
        <header className="bg-background/90 sticky top-0 z-30 flex h-14 shrink-0 items-center border-b px-3 backdrop-blur lg:hidden">
          <Brand />
          <div className="ml-auto">
            <UserButton size="icon" />
          </div>
        </header>

        {/* Bounded height, no scroll of its own — the page inside owns scrolling. */}
        <main className="min-h-0 min-w-0 flex-1">{children}</main>
      </div>

      <BottomNav />
    </div>
  )
}
