import type { Metadata } from "next"
import Link from "next/link"
import { ReceiptIndianRupee } from "lucide-react"

import { Amount } from "@/components/finance/amount"
import { EmptyState } from "@/components/finance/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requirePageUser } from "@/lib/auth"
import { formatMonth } from "@/lib/format"
import {
  availablePeriods,
  monthsInPeriod,
  PERIOD_MODES,
  resolveSelected,
  type PeriodMode,
} from "@/lib/periods"
import { listPayslips } from "@/lib/services/payslips"

import { PayslipControls } from "./payslip-controls"
import { PayslipDeleteButton } from "./payslip-delete-button"
import { PayslipMatch } from "./payslip-match"
import { PayslipViewDialog } from "./payslip-dialog"

export const metadata: Metadata = { title: "Payslips" }

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="min-w-0">
        <p className="text-muted-foreground truncate text-[11px] md:text-xs">{label}</p>
        <div className="mt-0.5 truncate text-sm font-semibold tabular-nums md:text-lg">
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function PayslipsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[]; period?: string | string[] }>
}) {
  const [params, user] = await Promise.all([searchParams, requirePageUser()])
  const payslips = await listPayslips(user.id)

  if (payslips.length === 0) {
    return (
      <EmptyState
        icon={ReceiptIndianRupee}
        title="No payslips yet"
        hint="Drop payslip or fee-statement PDFs on the Imports page — each payout lands here, matched to its bank credit."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/imports">Go to Imports</Link>
          </Button>
        }
      />
    )
  }

  // Period filter over the payslip months. Available periods come from the slips
  // themselves so every option has data; FY is the natural default for payslips.
  const rawMode = typeof params.mode === "string" ? params.mode : undefined
  const mode: PeriodMode = PERIOD_MODES.includes(rawMode as PeriodMode)
    ? (rawMode as PeriodMode)
    : "FY"
  const requestedPeriod = typeof params.period === "string" ? params.period : undefined

  const available = availablePeriods(payslips.map((p) => p.periodMonth.slice(0, 7)))
  const selected = resolveSelected(mode, requestedPeriod, available)

  // Restrict to slips whose month falls in the selected period; if the mode
  // yields no period (shouldn't happen while slips exist), show them all.
  const periodMonths = selected ? new Set(monthsInPeriod(mode, selected)) : null
  const filtered = periodMonths
    ? payslips.filter((p) => periodMonths.has(p.periodMonth.slice(0, 7)))
    : payslips

  const matched = filtered.filter((p) => p.matched !== null)
  // Total actually RECEIVED = the linked bank-credit amounts, not the slip's
  // net. A net-zero slip (advance recovered) still credited real money earlier,
  // so counting the matched credit reflects what hit the account. Integer paise
  // for the sum; amounts stay decimal strings.
  const totalPaise = matched.reduce(
    (sum, p) => sum + Math.round(Number(p.matched?.amount ?? p.netPay) * 100),
    0
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PayslipControls
          mode={mode}
          selected={selected ?? ""}
          months={available.months}
          years={available.years}
          financialYears={available.financialYears}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ReceiptIndianRupee}
          title="No payslips this period"
          hint="No payouts landed in the selected period. Pick another month, year or financial year above."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <Kpi label="Received">
              <Amount value={totalPaise / 100} signed={false} />
            </Kpi>
            <Kpi label="Payslips">{filtered.length}</Kpi>
            <Kpi label="Matched">
              {matched.length} of {filtered.length}
            </Kpi>
          </div>

          <Card size="sm">
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">Month</TableHead>
                    <TableHead className="h-8 text-xs">Kind</TableHead>
                    <TableHead className="h-8 text-xs">Employer</TableHead>
                    <TableHead className="h-8 text-right text-xs">Gross</TableHead>
                    <TableHead className="h-8 text-right text-xs">Deductions</TableHead>
                    <TableHead className="h-8 text-right text-xs">Net</TableHead>
                    <TableHead className="h-8 text-xs">Match</TableHead>
                    <TableHead className="h-8 text-right text-xs">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((payslip) => (
                    <TableRow key={payslip.id}>
                      <TableCell className="font-medium">
                        {formatMonth(payslip.periodMonth)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {payslip.kind === "SALARY" ? "Salary" : "Contractor fee"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-44">
                        <span className="block truncate">{payslip.employer}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Amount value={payslip.grossEarnings} signed={false} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Amount
                          value={payslip.totalDeductions}
                          signed={false}
                          className="text-muted-foreground"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(payslip.netPay) === 0 ? (
                          <span className="text-muted-foreground">NIL</span>
                        ) : (
                          <Amount value={payslip.netPay} signed={false} className="font-medium" />
                        )}
                      </TableCell>
                      <TableCell>
                        <PayslipMatch payslip={payslip} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-0.5">
                          <PayslipViewDialog payslip={payslip} />
                          <PayslipDeleteButton
                            payslipId={payslip.id}
                            periodMonth={payslip.periodMonth}
                            employer={payslip.employer}
                          />
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
