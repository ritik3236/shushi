import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Empty state with a directional hint — never a bare "No data". */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  hint: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center",
        className
      )}
    >
      <Icon className="text-muted-foreground size-6" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground max-w-sm text-sm">{hint}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
