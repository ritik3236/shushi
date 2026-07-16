import type { Metadata } from "next"
import Link from "next/link"
import { DateTime } from "luxon"
import { SearchX, Upload, UserRound } from "lucide-react"

import { Amount } from "@/components/finance/amount"
import { EmptyState } from "@/components/finance/empty-state"
import { Button } from "@/components/ui/button"
import { APP_TIMEZONE } from "@/lib/constants"
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

import { CategoryCell } from "./category-cell"
import { FilterRow } from "./filter-row"
import { PageLink } from "./page-link"
import { TransactionsPanel } from "./panel"
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
    <div className="group hover:bg-muted/50 odd:bg-muted/[0.18] relative flex items-center gap-2 px-3 py-1 text-[13px] transition-colors">
      {row.account.color ? (
        <span
          title={row.account.name}
          className="absolute inset-y-0 left-0 w-1"
          style={{ background: `var(--${row.account.color})` }}
        />
      ) : null}
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
        {row.excludeFromSpend || row.person ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="opacity-55">
                  <Amount value={row.amount} direction={row.direction} />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {row.person
                  ? `On ${row.person.name}'s khata — not counted in spend or income`
                  : "Excluded from spend"}
              </TooltipContent>
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
  // "Today"/"Yesterday" are relative to the user's timezone (IST), not the
  // server's UTC clock — otherwise before ~5:30am IST the labels lag a day.
  const nowLocal = DateTime.now().setZone(APP_TIMEZONE)
  const todayISO = nowLocal.toISODate() ?? ""
  const yesterdayISO = nowLocal.minus({ days: 1 }).toISODate() ?? ""
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
  // The day total mirrors the dashboard's spend/income net: transfers, khata
  // (person-assigned), and excludeFromSpend rows don't count — else a day of only
  // self-transfers shows a bogus net. `counted` gates the chip so a day with no
  // spend/income rows shows none.
  const countsForNet = (row: TransactionRow): boolean =>
    !row.excludeFromSpend && row.person === null && row.category?.kind !== "TRANSFER"
  const groups: { date: string; rows: TransactionRow[]; net: number; counted: number }[] = []
  for (const row of data.rows) {
    let group = groups[groups.length - 1]
    if (!group || group.date !== row.date) {
      group = { date: row.date, rows: [], net: 0, counted: 0 }
      groups.push(group)
    }
    group.rows.push(row)
    if (countsForNet(row)) {
      group.net += row.direction === "CREDIT" ? Number(row.amount) : -Number(row.amount)
      group.counted += 1
    }
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
    <TransactionsPanel
      toolbar={
        <FilterRow
          months={months}
          accounts={accounts}
          categories={categoryOptions}
          tags={tags}
          people={people}
        />
      }
    >
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
                  {group.counted > 0 ? (
                    <Amount
                      value={Math.abs(group.net)}
                      direction={group.net >= 0 ? "CREDIT" : "DEBIT"}
                      className="text-[11px] opacity-80"
                    />
                  ) : null}
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
              <PageLink href={pageHref(sp, data.page - 1)} disabled={data.page <= 1}>
                Prev
              </PageLink>
              <PageLink href={pageHref(sp, data.page + 1)} disabled={data.page >= data.pageCount}>
                Next
              </PageLink>
            </div>
          </div>
        </>
      )}
    </TransactionsPanel>
  )
}
