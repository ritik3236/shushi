import { cn } from "@/lib/utils"

/**
 * A page's own layout box. The shell imposes no width or padding, so each page
 * opts into this (or rolls its own) — a list page can go full-bleed, a form page
 * can stay narrow. Default is a centered, padded column.
 */
export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6", className)}>
      {children}
    </div>
  )
}
