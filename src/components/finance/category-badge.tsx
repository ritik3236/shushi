import { cn } from "@/lib/utils"

/** Category chip: token-colored dot + "Parent › Child". Color is a chart token key. */
export function CategoryBadge({
  name,
  parentName,
  color,
  className,
}: {
  name: string
  parentName?: string | null
  color?: string | null
  className?: string
}) {
  return (
    <span className={cn("text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs", className)}>
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ background: color ? `var(--${color})` : "var(--muted-foreground)" }}
      />
      <span className="truncate">{parentName ? `${parentName} › ${name}` : name}</span>
    </span>
  )
}
