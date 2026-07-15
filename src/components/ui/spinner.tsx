import { Loader2, type LucideProps } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The app's spinner: a spinning Loader2 with the reduced-motion guard baked in.
 * Decorative by default (aria-hidden) — pair it with visible or sr-only text to
 * announce loading. Size and color come from className (defaults to size-4).
 */
export function Spinner({ className, ...props }: LucideProps) {
  return (
    <Loader2
      aria-hidden
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
      {...props}
    />
  )
}
