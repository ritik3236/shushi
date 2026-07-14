import type { Metadata } from "next"
import Link from "next/link"
import { SearchX, Upload, UserRound } from "lucide-react"

import { Amount } from "@/components/finance/amount"
import { EmptyState } from "@/components/finance/empty-state"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { requirePageUser } from "@/lib/auth"
import { formatDayMonth } from "@/lib/format"
import { listPersonOptions } from "@/lib/services/people"
import { getTransactionFilterOptions } from "@/lib/services/transaction-filters"
import {
  listTransactions,
  type TransactionFilters,
  type TransactionRow,
} from "@/lib/services/transactions"
import { cn } from "@/lib/utils"

import { CategoryCell } from "./category-cell"
import { FilterRow } from "./filter-row"
import { RowActions } from "./row-actions"

export const metadata: Metadata = { title: "Transactions" }

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined
}

function toFilters(sp: SearchParams): TransactionFilters {
  const direction = first(sp.direction)
  const page = Number(first(sp.page))
  return {
    month: first(sp.month),
    from: first(sp.from),
    to: first(sp.to),
    accountId: first(sp.account),
    categoryId: first(sp.category),
    direction: direction === "DEBIT" || direction === "CREDIT" ? direction : undefined,
    q: first(sp.q),
    tag: first(sp.tag),
    person: first(sp.person),
    onlyUncategorized: first(sp.uncategorized) === "1",
    hideTransfers: first(sp.hideTransfers) === "1",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  }
}

function pageHref(sp: SearchParams, target: number): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (key !== "page" && typeof value === "string" && value !== "") params.set(key, value)
  }
  if (target > 1) params.set("page", String(target))
  const qs = params.toString()
  return qs ? `/transactions?${qs}` : "/transactions"
}

const countFormat = new Intl.NumberFormat("en-IN")

/** The merchant/person to lead a row with — the counterparty, else the narration. */
function primaryName(row: TransactionRow): string {
  return row.counterparty ?? row.narration
}

function TxRow({ row, categoryOptions, tagNames, people }: {
  row: TransactionRow
  categoryOptions: React.ComponentProps<typeof CategoryCell>["options"]
  tagNames: string[]
  people: { id: string; name: string }[]
}) {
  return (
    <div className="group hover:bg-muted/50 odd:bg-muted/[0.18] flex items-center gap-2 px-3 py-1 text-[13px] transition-colors">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 truncate font-medium">{primaryName(row)}</span>
        {row.person ? (
          <span className="bg-primary/10 text-primary inline-flex shrink-0 items-center gap-0.5 rounded-sm px-1 py-px text-[10px] font-medium">
            <UserRound className="size-2.5" />
            {row.person.name}
          </span>
        ) : null}
      </div>
      <CategoryCell
        transactionId={row.id}
        categoryId={row.category?.id ?? null}
        options={categoryOptions}
      />
      <div className="w-24 shrink-0 text-right">
        {row.excludeFromSpend ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="opacity-55">
                  <Amount value={row.amount} direction={row.direction} />
                </span>
              </TooltipTrigger>
              <TooltipContent>Excluded from spend</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Amount value={row.amount} direction={row.direction} />
        )}
      </div>
      <div className="shrink-0 opacity-100 transition-opacity group-focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
        <RowActions
          row={row}
          categoryOptions={categoryOptions}
          tagSuggestions={tagNames}
          people={people}
        />
      </div>
    </div>
  )
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const filters = toFilters(sp)
  const filtersActive = Boolean(
    filters.month ||
      filters.from ||
      filters.to ||
      filters.accountId ||
      filters.categoryId ||
      filters.direction ||
      filters.q ||
      filters.tag ||
      filters.person ||
      filters.onlyUncategorized ||
      filters.hideTransfers
  )

  const user = await requirePageUser()
  const [data, options, people] = await Promise.all([
    listTransactions(user.id, filters),
    getTransactionFilterOptions(user.id),
    listPersonOptions(user.id),
  ])
  const { months, categories: categoryOptions, accounts, tags } = options
  const tagNames = tags.map((t) => t.tag)

  // Group rows into consecutive days (rows arrive newest-first) and net each day.
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)
  const yesterdayISO = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10)
  const currentYear = todayISO.slice(0, 4)
  const dayHeading = (iso: string): string => {
    if (iso === todayISO) return "Today"
    if (iso === yesterdayISO) return "Yesterday"
    const weekday = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    })
    const year = iso.slice(0, 4)
    return `${weekday}, ${formatDayMonth(iso)}${year !== currentYear ? ` ${year}` : ""}`
  }
  const groups: { date: string; rows: TransactionRow[]; net: number }[] = []
  for (const row of data.rows) {
    let group = groups[groups.length - 1]
    if (!group || group.date !== row.date) {
      group = { date: row.date, rows: [], net: 0 }
      groups.push(group)
    }
    group.rows.push(row)
    group.net += row.direction === "CREDIT" ? Number(row.amount) : -Number(row.amount)
  }

  const noDataAtAll = data.total === 0 && !filtersActive

  if (noDataAtAll) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={Upload}
          title="No transactions yet"
          hint="Import a bank or credit card statement and every transaction will land here."
          action={
            <Button asChild size="sm">
              <Link href="/imports">Import statements</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full justify-center">
      {/* A raised card panel on the recessed page ground — the list's own surface. */}
      <div className="bg-card border-border/60 flex h-full w-full max-w-3xl flex-col border-x">
        {/* Fixed toolbar — part of the chrome, never scrolls. */}
        <div className="shrink-0 border-b">
          <div className="px-3 py-2">
            <FilterRow
              months={months}
              accounts={accounts}
              categories={categoryOptions}
              tags={tags}
              people={people}
            />
          </div>
        </div>

        {/* The only thing that scrolls: the list. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="pb-[calc(env(safe-area-inset-bottom)+5rem)] lg:pb-6">
          {data.rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={SearchX}
                title="No matching transactions"
                hint="Nothing matches the current filters — loosen them or clear everything."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/transactions">Clear filters</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="divide-border/60 divide-y">
                {groups.map((group) => (
                  <section key={group.date}>
                    <div className="text-muted-foreground bg-muted/30 flex items-center justify-between px-3 py-1.5 text-[11px] font-medium tracking-wide">
                      <span className="uppercase">{dayHeading(group.date)}</span>
                      <Amount
                        value={Math.abs(group.net)}
                        direction={group.net >= 0 ? "CREDIT" : "DEBIT"}
                        className="text-[11px] opacity-80"
                      />
                    </div>
                    {group.rows.map((row) => (
                      <TxRow
                        key={row.id}
                        row={row}
                        categoryOptions={categoryOptions}
                        tagNames={tagNames}
                        people={people}
                      />
                    ))}
                  </section>
                ))}
              </div>
              <div className="text-muted-foreground flex items-center justify-between px-3 py-3 text-xs">
                <span>
                  {countFormat.format(data.total)} transaction{data.total === 1 ? "" : "s"} · page{" "}
                  {data.page} of {data.pageCount}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className={cn(data.page <= 1 && "pointer-events-none opacity-50")}
                  >
                    <Link
                      href={pageHref(sp, data.page - 1)}
                      aria-disabled={data.page <= 1}
                      tabIndex={data.page <= 1 ? -1 : undefined}
                    >
                      Prev
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className={cn(data.page >= data.pageCount && "pointer-events-none opacity-50")}
                  >
                    <Link
                      href={pageHref(sp, data.page + 1)}
                      aria-disabled={data.page >= data.pageCount}
                      tabIndex={data.page >= data.pageCount ? -1 : undefined}
                    >
                      Next
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
