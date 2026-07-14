"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatINR, formatINRCompact } from "@/lib/format"
import { cn } from "@/lib/utils"

// Purpose-named, token-bound chart wrappers. Every color comes from a CSS
// variable so charts follow the theme. Consumers own the height (h-[220px]
// wrapper) — ResponsiveContainer renders 0px without a definite-height parent.

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" } as const

/** Monthly income vs spend. Income = success token, spend = destructive. */
export function IncomeSpendChart({
  data,
}: {
  data: { label: string; income: number; spend: number }[]
}) {
  if (!data.length) return null
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={46}
          tickFormatter={(value) => formatINRCompact(Number(value))}
        />
        <Tooltip
          cursor={{ fill: "color-mix(in srgb, var(--muted) 60%, transparent)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--popover-foreground)",
            fontSize: 12,
          }}
          formatter={(value, name) => [
            formatINR(Number(value)),
            name === "income" ? "Income" : "Spend",
          ]}
        />
        <Bar dataKey="income" fill="var(--success)" radius={[3, 3, 0, 0]} maxBarSize={20} />
        <Bar dataKey="spend" fill="var(--destructive)" radius={[3, 3, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * Stacked horizontal distribution bar — below the complexity floor for
 * recharts, token-colored flex divs win.
 */
export function DistributionBar({
  slices,
  className,
}: {
  slices: { name: string; share: number; color: string | null }[]
  className?: string
}) {
  if (!slices.length) return null
  return (
    <div className={cn("flex h-2 w-full overflow-hidden rounded-full", className)}>
      {slices.map((slice, index) => (
        <div
          key={`${slice.name}-${index}`}
          title={slice.name}
          className="h-full"
          style={{
            width: `${Math.max(1, slice.share * 100)}%`,
            background: slice.color ? `var(--${slice.color})` : "var(--muted-foreground)",
          }}
        />
      ))}
    </div>
  )
}
