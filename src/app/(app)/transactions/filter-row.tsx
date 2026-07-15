"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Check, Hash, SlidersHorizontal, UserRound, X } from "lucide-react"

import { CategorySelect } from "@/components/finance/category-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatMonth } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { CategoryOption } from "@/lib/services/categories"

import { DateRangeFilter, type DateRangeValue } from "./date-range-filter"
import { useTransactionNav } from "./panel"
import { TagFilter } from "./tag-filter"

/** Every URL key that counts toward the "active filters" badge. */
const ACTIVE_KEYS = [
  "month",
  "account",
  "category",
  "direction",
  "q",
  "tag",
  "person",
  "uncategorized",
  "hideTransfers",
] as const

type Updates = Record<string, string | null>

/**
 * The transactions controls row: primary filters inline on desktop, everything
 * behind a Filters drawer on mobile. Every control writes searchParams and
 * resets pagination.
 */
export function FilterRow({
  months,
  accounts,
  categories,
  tags,
  people,
}: {
  months: string[]
  accounts: { id: string; name: string }[]
  categories: CategoryOption[]
  tags: { tag: string; count: number }[]
  people: { id: string; name: string }[]
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { navigate } = useTransactionNav()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const q = searchParams.get("q") ?? ""
  const [search, setSearch] = useState(q)
  const [syncedQ, setSyncedQ] = useState(q)
  // Re-seed the input when the URL changes underneath us (back/forward, Clear).
  if (q !== syncedQ) {
    setSyncedQ(q)
    setSearch(q)
  }

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    },
    []
  )

  const apply = useCallback(
    (updates: Updates) => {
      const params = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      params.delete("page")
      const qs = params.toString()
      navigate(qs ? `${pathname}?${qs}` : pathname)
    },
    [navigate, pathname, searchParams]
  )

  function handleSearch(value: string) {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      apply({ q: value.trim() || null })
    }, 300)
  }

  function clearAll() {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    setSearch("")
    setDrawerOpen(false)
    navigate(pathname)
  }

  const dateActive = Boolean(searchParams.get("from") || searchParams.get("to"))
  const activeCount =
    ACTIVE_KEYS.filter((key) => searchParams.get(key)).length + (dateActive ? 1 : 0)
  const activeTag = searchParams.get("tag")
  const activePerson = searchParams.get("person")
  const activePersonName = people.find((p) => p.id === activePerson)?.name

  const monthValue = searchParams.get("month") ?? "all"
  const accountValue = searchParams.get("account") ?? "all"
  const dateRange: DateRangeValue = {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Primary filters, inline on desktop only. */}
      <div className="hidden items-center gap-2 md:flex">
        <Select
          value={monthValue}
          onValueChange={(value) =>
            apply({ month: value === "all" ? null : value, from: null, to: null })
          }
        >
          <SelectTrigger className="w-32" aria-label="Filter by month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {formatMonth(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangeFilter
          value={dateRange}
          months={2}
          onChange={(next) => apply({ from: next.from, to: next.to, month: null })}
        />

        <Select
          value={accountValue}
          onValueChange={(value) => apply({ account: value === "all" ? null : value })}
        >
          <SelectTrigger className="w-36" aria-label="Filter by account">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

      </div>

      <Input
        value={search}
        onChange={(event) => handleSearch(event.target.value)}
        placeholder="Search narration…"
        aria-label="Search transactions"
        className="h-8 min-w-0 flex-1 md:w-52 md:flex-none"
      />

      {activeTag ? (
        <Button
          variant="secondary"
          size="sm"
          className="h-8 gap-1"
          onClick={() => apply({ tag: null })}
          aria-label={`Remove tag filter ${activeTag}`}
        >
          <Hash className="opacity-60" />
          {activeTag}
          <X className="opacity-60" />
        </Button>
      ) : null}

      {activePerson ? (
        <Button
          variant="secondary"
          size="sm"
          className="h-8 gap-1"
          onClick={() => apply({ person: null })}
          aria-label={`Remove person filter ${activePersonName ?? ""}`}
        >
          <UserRound className="opacity-60" />
          {activePersonName ?? "Person"}
          <X className="opacity-60" />
        </Button>
      ) : null}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <SlidersHorizontal />
            Filters
            {activeCount > 0 ? (
              <span className="bg-primary text-primary-foreground ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums">
                {activeCount}
              </span>
            ) : null}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <FiltersDrawer
            months={months}
            accounts={accounts}
            categories={categories}
            tags={tags}
            people={people}
            initial={{
              month: searchParams.get("month") ?? "",
              from: searchParams.get("from"),
              to: searchParams.get("to"),
              account: searchParams.get("account") ?? "",
              category: searchParams.get("category"),
              direction: searchParams.get("direction") ?? "",
              tag: searchParams.get("tag"),
              person: searchParams.get("person") ?? "",
              uncategorized: searchParams.get("uncategorized") === "1",
              hideTransfers: searchParams.get("hideTransfers") === "1",
            }}
            onApply={(updates) => {
              apply(updates)
              setDrawerOpen(false)
            }}
            onClear={clearAll}
          />
        </SheetContent>
      </Sheet>

      {activeCount > 0 ? (
        <Button variant="ghost" size="sm" className="h-8" onClick={clearAll}>
          Clear
        </Button>
      ) : null}
    </div>
  )
}

type DrawerInitial = {
  month: string
  from: string | null
  to: string | null
  account: string
  category: string | null
  direction: string
  tag: string | null
  person: string
  uncategorized: boolean
  hideTransfers: boolean
}

/**
 * The full set of filters inside the drawer, staged in local state and committed
 * on Apply. Remounts (and re-seeds from the URL) each time the drawer opens.
 */
function FiltersDrawer({
  months,
  accounts,
  categories,
  tags,
  people,
  initial,
  onApply,
  onClear,
}: {
  months: string[]
  accounts: { id: string; name: string }[]
  categories: CategoryOption[]
  tags: { tag: string; count: number }[]
  people: { id: string; name: string }[]
  initial: DrawerInitial
  onApply: (updates: Updates) => void
  onClear: () => void
}) {
  const [month, setMonth] = useState(initial.month)
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: initial.from,
    to: initial.to,
  })
  const [account, setAccount] = useState(initial.account)
  const [category, setCategory] = useState(initial.category)
  const [direction, setDirection] = useState(initial.direction)
  const [tag, setTag] = useState(initial.tag)
  const [person, setPerson] = useState(initial.person)
  const [uncategorized, setUncategorized] = useState(initial.uncategorized)
  const [hideTransfers, setHideTransfers] = useState(initial.hideTransfers)

  function submit() {
    onApply({
      month: month || null,
      from: dateRange.from,
      to: dateRange.to,
      account: account || null,
      category,
      direction: direction || null,
      tag,
      person: person || null,
      uncategorized: uncategorized ? "1" : null,
      hideTransfers: hideTransfers ? "1" : null,
    })
  }

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <Field label="Month">
          <Select
            value={month || "all"}
            onValueChange={(v) => {
              setMonth(v === "all" ? "" : v)
              if (v !== "all") setDateRange({ from: null, to: null })
            }}
          >
            <SelectTrigger className="w-full" aria-label="Filter by month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonth(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Date range">
          <DateRangeFilter
            value={dateRange}
            className="w-full"
            onChange={(next) => {
              setDateRange(next)
              if (next.from || next.to) setMonth("")
            }}
          />
        </Field>

        <Field label="Account">
          <Select value={account || "all"} onValueChange={(v) => setAccount(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full" aria-label="Filter by account">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {people.length > 0 ? (
          <Field label="Person">
            <Select value={person || "all"} onValueChange={(v) => setPerson(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full" aria-label="Filter by person">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All people</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <Field label="Direction">
          <Tabs value={direction || "all"} onValueChange={(v) => setDirection(v === "all" ? "" : v)}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                All
              </TabsTrigger>
              <TabsTrigger
                value="DEBIT"
                className="flex-1 data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive dark:data-[state=active]:text-destructive"
              >
                Money out
              </TabsTrigger>
              <TabsTrigger
                value="CREDIT"
                className="flex-1 data-[state=active]:bg-success/15 data-[state=active]:text-success dark:data-[state=active]:text-success"
              >
                Money in
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>

        <Field label="Category">
          <CategorySelect
            options={categories}
            value={category}
            onChange={(id) => {
              setCategory(id)
              if (id) setUncategorized(false)
            }}
            placeholder="All categories"
            className="h-8 w-full"
          />
        </Field>

        <Field label="Tag">
          <TagFilter tags={tags} value={tag} onChange={setTag} />
        </Field>

        <Field label="Options">
          <div className="grid gap-2">
            <ToggleRow
              label="Only uncategorized"
              active={uncategorized}
              onToggle={() => {
                const next = !uncategorized
                setUncategorized(next)
                if (next) setCategory(null)
              }}
            />
            <ToggleRow
              label="Hide transfers"
              active={hideTransfers}
              onToggle={() => setHideTransfers((v) => !v)}
            />
          </div>
        </Field>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <Button variant="ghost" size="sm" className="h-8" onClick={onClear}>
          Clear
        </Button>
        <Button size="sm" className="h-8" onClick={submit}>
          Apply
        </Button>
      </SheetFooter>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs font-normal">{label}</Label>
      {children}
    </div>
  )
}

/** A clear on/off filter toggle — a bordered row that tints when active. */
function ToggleRow({
  label,
  active,
  onToggle,
}: {
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "flex h-9 items-center justify-between gap-2 rounded-md border px-3 text-left text-sm transition-colors",
        "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "border-primary/50 bg-primary/10 text-foreground font-medium"
          : "text-muted-foreground hover:bg-muted"
      )}
    >
      <span className="truncate">{label}</span>
      <Check className={cn("size-4 shrink-0 transition-opacity", active ? "opacity-100" : "opacity-0")} />
    </button>
  )
}
