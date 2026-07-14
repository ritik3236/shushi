"use client"

import { Amount } from "@/components/finance/amount"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { formatMonth } from "@/lib/format"
import type { PayslipListRow } from "@/lib/services/payslips"

function BreakdownColumn({
  title,
  lines,
  totalLabel,
  total,
}: {
  title: string
  lines: { label: string; amount: string }[]
  totalLabel: string
  total: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        {title}
      </p>
      {lines.length ? (
        <ul className="space-y-1">
          {lines.map((line, index) => (
            <li key={index} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground min-w-0 truncate">{line.label}</span>
              <Amount value={line.amount} signed={false} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">None</p>
      )}
      <Separator className="my-2" />
      <div className="flex items-baseline justify-between gap-2 text-xs font-medium">
        <span>{totalLabel}</span>
        <Amount value={total} signed={false} />
      </div>
    </div>
  )
}

/** Row action: full earnings/deductions breakdown for one payslip. */
export function PayslipViewDialog({ payslip }: { payslip: PayslipListRow }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">
            {payslip.employer} · {formatMonth(payslip.periodMonth)}
          </DialogTitle>
          <DialogDescription>
            {payslip.kind === "SALARY" ? "Salary payslip" : "Contractor fee statement"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <BreakdownColumn
            title="Earnings"
            lines={payslip.earnings}
            totalLabel="Gross"
            total={payslip.grossEarnings}
          />
          <BreakdownColumn
            title="Deductions"
            lines={payslip.deductions}
            totalLabel="Total"
            total={payslip.totalDeductions}
          />
        </div>
        <Separator />
        <div className="flex items-baseline justify-between text-sm font-medium">
          <span>Net pay</span>
          <Amount value={payslip.netPay} signed={false} />
        </div>
        <p className="text-muted-foreground truncate text-xs">{payslip.fileName}</p>
      </DialogContent>
    </Dialog>
  )
}
