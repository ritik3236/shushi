import type { Metadata } from "next"
import Link from "next/link"
import { SearchX, Upload } from "lucide-react"

import { Amount } from "@/components/finance/amount"
import { EmptyState } from "@/components/finance/empty-state"
import { TransferBadge } from "@/components/finance/transfer-badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { requirePageUser } from "@/lib/auth"
import { formatDayMonth } from "@/lib/format"
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
    accountId: first(sp.account),
    categoryId: first(sp.category),
    direction: direction === "DEBIT" || direction === "CREDIT" ? direction : undefined,
    q: first(sp.q),
    tag: first(sp.tag),
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

function DetailsCell({ row }: { row: TransactionRow }) {
  const primary =
    row.counterparty ?? `${row.narration.slice(0, 40)}${row.narration.length > 40 ? "…" : ""}`
  const hasSecondLine = Boolean(
    row.counterparty || row.channel || row.transferKind || row.tags.length
  )
  return (
    <div className="min-w-0">
      <div className={cn("max-w-[380px] truncate", row.counterparty && "font-medium")}>
        {primary}
      </div>
      {hasSecondLine ? (
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {row.counterparty ? (
            <span className="text-muted-foreground max-w-[380px] truncate text-xs">
              {row.narration}
            </span>
          ) : null}
          {row.channel ? (
            <span className="bg-muted text-muted-foreground shrink-0 rounded-sm px-1 py-px text-[10px]">
              {row.channel}
            </span>
          ) : null}
          {row.transferKind ? <TransferBadge kind={row.transferKind} /> : null}
          {row.tags.map((tag) => (
            <span
              key={tag}
              className="bg-muted text-muted-foreground shrink-0 rounded-sm px-1 py-px text-[10px]"
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AmountCell({ row }: { row: TransactionRow }) {
  if (!row.excludeFromSpend) return <Amount value={row.amount} direction={row.direction} />
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="opacity-60">
            <Amount value={row.amount} direction={row.direction} />
          </span>
        </TooltipTrigger>
        <TooltipContent>Excluded from spend</TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
      filters.accountId ||
      filters.categoryId ||
      filters.direction ||
      filters.q ||
      filters.tag ||
      filters.onlyUncategorized ||
      filters.hideTransfers
  )

  const user = await requirePageUser()
  const [data, options] = await Promise.all([
    listTransactions(user.id, filters),
    getTransactionFilterOptions(user.id),
  ])
  const { months, categories: categoryOptions, accounts, tags } = options
  const tagNames = tags.map((t) => t.tag)
  const currentYear = String(new Date().getFullYear())

  const noDataAtAll = data.total === 0 && !filtersActive

  return (
    <>
      {noDataAtAll ? (
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
      ) : (
        <div className="space-y-3">
          <FilterRow
            months={months}
            accounts={accounts}
            categories={categoryOptions}
            tags={tags}
          />
          {data.rows.length === 0 ? (
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
          ) : (
            <Card className="gap-0 overflow-hidden py-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="hidden lg:table-cell">Account</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-8">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => {
                    const year = row.date.slice(0, 4)
                    return (
                      <TableRow key={row.id} className="text-sm">
                        <TableCell className="py-2">
                          {formatDayMonth(row.date)}
                          {year !== currentYear ? (
                            <span className="text-muted-foreground text-xs"> {year}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="py-2">
                          <DetailsCell row={row} />
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden py-2 text-xs lg:table-cell">
                          {row.account.name}
                        </TableCell>
                        <TableCell className="py-2">
                          <CategoryCell
                            transactionId={row.id}
                            categoryId={row.category?.id ?? null}
                            options={categoryOptions}
                          />
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <AmountCell row={row} />
                        </TableCell>
                        <TableCell className="py-2">
                          <RowActions
                            row={row}
                            categoryOptions={categoryOptions}
                            tagSuggestions={tagNames}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              </div>
              <div className="flex items-center justify-between border-t px-4 py-2">
                <p className="text-muted-foreground text-xs">
                  {countFormat.format(data.total)} transaction{data.total === 1 ? "" : "s"} · page{" "}
                  {data.page} of {data.pageCount}
                </p>
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
            </Card>
          )}
        </div>
      )}
    </>
  )
}
