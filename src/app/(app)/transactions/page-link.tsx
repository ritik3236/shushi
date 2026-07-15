"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useTransactionNav } from "./panel"

/**
 * Prev/Next pager. Navigates through the shared transaction transition (not a raw
 * <Link>) so paging shows the same loading overlay as applying a filter.
 */
export function PageLink({
  href,
  disabled,
  children,
}: {
  href: string
  disabled: boolean
  children: React.ReactNode
}) {
  const { navigate } = useTransactionNav()
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(disabled && "pointer-events-none opacity-50")}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) navigate(href)
      }}
    >
      {children}
    </Button>
  )
}
