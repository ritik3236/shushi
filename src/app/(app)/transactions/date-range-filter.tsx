"use client"

import { useState } from "react"
import { CalendarRange, X } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDayMonth } from "@/lib/format"
import { cn } from "@/lib/utils"

export type DateRangeValue = { from: string | null; to: string | null }

/** "yyyy-MM-dd" → local Date (midnight), so the picker shows the day the user picked. */
function parse(value: string | null): Date | undefined {
  if (!value) return undefined
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

/** local Date → "yyyy-MM-dd" (no UTC shift, matching parse()). */
function format(date: Date | undefined): string | null {
  if (!date) return null
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function label({ from, to }: DateRangeValue): string | null {
  if (from && to) return `${formatDayMonth(from)} – ${formatDayMonth(to)}`
  if (from) return `From ${formatDayMonth(from)}`
  if (to) return `Until ${formatDayMonth(to)}`
  return null
}

/**
 * Date-range picker backed by two searchParam-friendly ISO strings. Controlled:
 * inline the parent commits to the URL, in the drawer it stages local state.
 */
export function DateRangeFilter({
  value,
  onChange,
  months = 1,
  align = "start",
  className,
}: {
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  /** Calendar panes shown side by side (2 reads better on desktop). */
  months?: 1 | 2
  align?: "start" | "center" | "end"
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const active = Boolean(value.from || value.to)
  const text = label(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 justify-start gap-1.5 font-normal",
            active ? "pr-1" : "text-muted-foreground",
            className
          )}
          aria-label="Filter by date range"
        >
          <CalendarRange className="opacity-60" />
          <span className="truncate">{text ?? "Date range"}</span>
          {active ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date range"
              className="hover:bg-muted ml-auto inline-flex size-5 items-center justify-center rounded-sm"
              onClick={(event) => {
                event.stopPropagation()
                onChange({ from: null, to: null })
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  event.stopPropagation()
                  onChange({ from: null, to: null })
                }
              }}
            >
              <X className="size-3.5 opacity-60" />
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <Calendar
          mode="range"
          autoFocus
          numberOfMonths={months}
          defaultMonth={parse(value.to) ?? parse(value.from) ?? new Date()}
          selected={{ from: parse(value.from), to: parse(value.to) }}
          onSelect={(range?: DateRange) =>
            onChange({ from: format(range?.from), to: format(range?.to) })
          }
        />
        <div className="flex justify-end border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            disabled={!active}
            onClick={() => onChange({ from: null, to: null })}
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
