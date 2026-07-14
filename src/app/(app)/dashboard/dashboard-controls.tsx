"use client"

import { useRouter, useSearchParams } from "next/navigation"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fyLabel, type PeriodMode } from "@/lib/periods"
import { formatMonth } from "@/lib/format"

// Period control for the dashboard: a Month / Year / Financial-Year toggle plus
// a selector whose options match the mode. Both write the URL (?mode=&period=);
// switching mode drops the stale period so the server resolves the newest one.

function periodOptions(
  mode: PeriodMode,
  months: string[],
  years: string[],
  financialYears: string[]
): { key: string; label: string }[] {
  if (mode === "MONTH") return months.map((m) => ({ key: m, label: formatMonth(m) }))
  if (mode === "YEAR") return years.map((y) => ({ key: y, label: y }))
  return financialYears.map((y) => ({ key: y, label: fyLabel(Number(y)) }))
}

export function DashboardControls({
  mode,
  selected,
  months,
  years,
  financialYears,
}: {
  mode: PeriodMode
  selected: string
  months: string[]
  years: string[]
  financialYears: string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const push = (next: URLSearchParams) => router.replace(`?${next.toString()}`, { scroll: false })

  const onModeChange = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set("mode", value)
    next.delete("period") // let the server pick the newest period for this mode
    push(next)
  }

  const onPeriodChange = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set("period", value)
    push(next)
  }

  const options = periodOptions(mode, months, years, financialYears)

  return (
    <div className="flex items-center gap-2">
      <Tabs value={mode} onValueChange={onModeChange}>
        <TabsList className="h-8">
          <TabsTrigger value="MONTH" className="text-xs">
            Month
          </TabsTrigger>
          <TabsTrigger value="YEAR" className="text-xs">
            Year
          </TabsTrigger>
          <TabsTrigger value="FY" className="text-xs">
            FY
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Select value={selected} onValueChange={onPeriodChange}>
        <SelectTrigger size="sm" className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {options.map((option) => (
            <SelectItem key={option.key} value={option.key}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
