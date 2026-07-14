import { formatINR, formatSignedINR } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * The one way money renders: mono, tabular, credits in success green with a
 * plus sign, debits neutral with a minus (when a direction is given).
 */
export function Amount({
  value,
  direction,
  signed = true,
  className,
}: {
  value: string | number
  direction?: "DEBIT" | "CREDIT"
  signed?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "font-mono whitespace-nowrap tabular-nums",
        direction === "CREDIT" && signed && "text-success",
        className
      )}
    >
      {direction && signed ? formatSignedINR(value, direction) : formatINR(value)}
    </span>
  )
}
