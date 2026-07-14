import type { Metadata } from "next"
import Link from "next/link"
import { FileText, PieChart, Upload, Wallet } from "lucide-react"

import { DistributionBar, IncomeSpendChart } from "@/components/charts"
import { Amount } from "@/components/finance/amount"
import { EmptyState } from "@/components/finance/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { requirePageUser } from "@/lib/auth"
import { formatMonth } from "@/lib/format"
import { PERIOD_MODES, type PeriodMode } from "@/lib/periods"
import { getDashboardData, type AccountSummary } from "@/lib/services/analytics"
import { cn } from "@/lib/utils"

import { DashboardControls } from "./dashboard-controls"

export const metadata: Metadata = { title: "Dashboard" }

const NUMERAL = "text-xl md:text-2xl font-semibold"

function Kpi({
  label,
  value,
  sub,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground text-xs">{label}</p>
        <div className="mt-1">{value}</div>
        {sub ? <div className="mt-0.5 min-w-0">{sub}</div> : null}
      </CardContent>
    </Card>
  )
}

/** Right side of an account row: savings balance, or credit card due/surplus. */
function AccountValue({ account }: { account: AccountSummary }) {
  if (account.type === "SAVINGS") {
    return account.balance ? (
      <Amount value={account.balance} signed={false} className="text-sm font-medium" />
    ) : (
      <span className="text-muted-foreground text-sm">—</span>
    )
  }
  const due = account.due === null ? null : Number(account.due)
  return (
    <div className="flex flex-col items-end">
      {due === null ? (
        <span className="text-muted-foreground text-sm">—</span>
      ) : due < 0 ? (
        <span className="text-muted-foreground text-xs">
          Surplus{" "}
          <Amount value={Math.abs(due)} signed={false} className="text-success text-sm font-medium" />
        </span>
      ) : (
        <span className="text-muted-foreground text-xs">
          Due{" "}
          <Amount value={due} signed={false} className="text-foreground text-sm font-medium" />
        </span>
      )}
      {account.creditLimit ? (
        <span className="text-muted-foreground text-[11px]">
          Limit <Amount value={account.creditLimit} signed={false} />
        </span>
      ) : null}
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[]; period?: string | string[] }>
}) {
  const [params, user] = await Promise.all([searchParams, requirePageUser()])
  const rawMode = typeof params.mode === "string" ? params.mode : undefined
  const mode: PeriodMode = PERIOD_MODES.includes(rawMode as PeriodMode)
    ? (rawMode as PeriodMode)
    : "MONTH"
  const requestedPeriod = typeof params.period === "string" ? params.period : undefined
  const data = await getDashboardData(user.id, mode, requestedPeriod)

  if (!data.hasData || !data.selected) {
    return (
      <EmptyState
        icon={Upload}
        title="Nothing to show yet"
        hint="Import a bank or credit card statement — income, spend and the category breakdown will appear here."
        action={
          <Button asChild>
            <Link href="/imports">Import statements</Link>
          </Button>
        }
      />
    )
  }

  const { kpis } = data
  const net = Number(kpis.net)
  const topSlices = data.categoryBreakdown.slice(0, 7)
  const savingsPct = kpis.savingsRate === null ? null : Math.round(kpis.savingsRate * 100)
  const uncategorizedHref =
    mode === "MONTH"
      ? `/transactions?uncategorized=1&month=${data.selected}`
      : "/transactions?uncategorized=1"

  return (
    <>
      <div className="mb-3 flex justify-end">
        <DashboardControls
          mode={data.mode}
          selected={data.selected}
          months={data.months}
          years={data.years}
          financialYears={data.financialYears}
        />
      </div>
      <div className="space-y-3">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="Income"
            value={<Amount value={kpis.income} signed={false} className={cn(NUMERAL, "text-success")} />}
          />
          <Kpi
            label="Spend"
            value={<Amount value={kpis.spend} signed={false} className={NUMERAL} />}
            sub={
              kpis.largestExpense ? (
                <p className="text-muted-foreground flex items-baseline gap-1 text-[11px]">
                  <span className="truncate">{kpis.largestExpense.label}</span>
                  <Amount value={kpis.largestExpense.amount} signed={false} />
                </p>
              ) : undefined
            }
          />
          <Kpi
            label="Net"
            value={
              <Amount
                value={kpis.net}
                signed={false}
                className={cn(NUMERAL, net > 0 && "text-success", net < 0 && "text-destructive")}
              />
            }
            sub={
              <p className="text-muted-foreground text-[11px]">
                {kpis.transactionCount.toLocaleString("en-IN")} transactions
              </p>
            }
          />
          <Kpi
            label="Savings rate"
            value={
              <p
                className={cn(
                  NUMERAL,
                  "font-mono tabular-nums",
                  savingsPct !== null && savingsPct >= 0 && "text-success",
                  savingsPct !== null && savingsPct < 0 && "text-destructive"
                )}
              >
                {savingsPct === null ? "—" : `${savingsPct}%`}
              </p>
            }
            sub={
              mode !== "MONTH" ? (
                <p className="text-muted-foreground flex items-baseline gap-1 text-[11px]">
                  <Amount value={kpis.avgMonthlySpend} signed={false} />
                  <span>/mo avg spend</span>
                </p>
              ) : undefined
            }
          />
        </div>

        {/* Trend + accounts */}
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">Income vs spend</p>
              <div className="h-[220px]">
                <IncomeSpendChart data={data.monthlySeries} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1">
              <p className="text-sm font-medium">Accounts</p>
              {data.accounts.length ? (
                <div className="divide-border divide-y">
                  {data.accounts.map((account) => (
                    <Link
                      key={account.id}
                      href="/accounts"
                      className="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{account.name}</p>
                        <p className="text-muted-foreground truncate text-xs">{account.bank}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <AccountValue account={account} />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Wallet}
                  title="No accounts yet"
                  hint="Accounts appear after your first statement import."
                  className="p-6"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Breakdown + payout / quick import */}
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">Where it went</p>
                <p className="text-muted-foreground text-xs">{data.label}</p>
              </div>
              {topSlices.length ? (
                <>
                  <DistributionBar slices={data.categoryBreakdown} />
                  <div className="space-y-1.5">
                    {topSlices.map((slice) => {
                      const row = (
                        <>
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{
                              background: slice.color
                                ? `var(--${slice.color})`
                                : "var(--muted-foreground)",
                            }}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">{slice.name}</span>
                          <Amount value={slice.amount} signed={false} className="text-sm" />
                          <span className="text-muted-foreground w-8 shrink-0 text-right text-xs tabular-nums">
                            {Math.round(slice.share * 100)}%
                          </span>
                        </>
                      )
                      return slice.categoryId === null ? (
                        <Link
                          key="uncategorized"
                          href={uncategorizedHref}
                          className="hover:bg-muted/50 -mx-2 flex items-center gap-2 rounded-md px-2 py-0.5 transition-colors"
                        >
                          {row}
                        </Link>
                      ) : (
                        <div key={slice.categoryId} className="flex items-center gap-2 py-0.5">
                          {row}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={PieChart}
                  title="No spend this period"
                  hint="Pick another period, or import a statement to see the breakdown."
                  className="p-6"
                />
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            <Card>
              <CardContent className="space-y-2">
                <p className="text-muted-foreground text-xs">Latest payout</p>
                {data.latestPayout ? (
                  <Link
                    href="/payslips"
                    className="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{data.latestPayout.employer}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatMonth(data.latestPayout.periodMonth)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Amount
                        value={data.latestPayout.netPay}
                        signed={false}
                        className="text-sm font-semibold"
                      />
                      {data.latestPayout.matched ? (
                        <Badge className="bg-success/10 text-success">Matched</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">
                          Not matched yet
                        </Badge>
                      )}
                    </div>
                  </Link>
                ) : (
                  <EmptyState
                    icon={FileText}
                    title="No payslips yet"
                    hint="Upload a payslip on the Payslips page to track salary payouts."
                    className="p-6"
                  />
                )}
              </CardContent>
            </Card>
            <Button asChild variant="outline" className="w-full">
              <Link href="/imports">
                <Upload />
                Import statements
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
