"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Link2, Link2Off, Search } from "lucide-react"
import { toast } from "sonner"

import { Amount } from "@/components/finance/amount"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDate, formatMonth } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { PayslipListRow } from "@/lib/services/payslips"
import type { LinkableCredit } from "@/lib/services/payslips"

import { linkPayslipAction, listLinkableCreditsAction, unlinkPayslipAction } from "./actions"

/** Match cell for a payslip row: shows the linked credit, or a Link control. */
export function PayslipMatch({ payslip }: { payslip: PayslipListRow }) {
  const router = useRouter()
  const [unlinking, startUnlink] = useTransition()

  if (payslip.matched) {
    return (
      <span className="flex items-center gap-2">
        <Badge variant="secondary" className="bg-success/10 text-success">
          Matched
        </Badge>
        <span className="text-muted-foreground text-xs">
          {formatDate(payslip.matched.date)} · {payslip.matched.accountName} ·{" "}
          <Amount value={payslip.matched.amount} signed={false} />
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Unlink credit"
          disabled={unlinking}
          onClick={() =>
            startUnlink(async () => {
              const res = await unlinkPayslipAction(payslip.id)
              if (res.ok) {
                toast.success("Unlinked")
                router.refresh()
              } else {
                toast.error(res.error)
              }
            })
          }
        >
          {unlinking ? <Spinner /> : <Link2Off />}
        </Button>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">no matching credit</span>
      <LinkCreditDialog payslip={payslip} />
    </span>
  )
}

function LinkCreditDialog({ payslip }: { payslip: PayslipListRow }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [credits, setCredits] = useState<LinkableCredit[]>([])
  const [loading, setLoading] = useState(true)
  const [linkingId, setLinkingId] = useState<string | null>(null)

  // Loading is flipped on in the open/search handlers (not here) so this effect
  // never calls setState synchronously in its body.
  useEffect(() => {
    if (!open) return
    let active = true
    const handle = setTimeout(async () => {
      const res = await listLinkableCreditsAction(payslip.id, search || undefined)
      if (!active) return
      if (res.ok) setCredits(res.data)
      else toast.error(res.error)
      setLoading(false)
    }, 250)
    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [open, search, payslip.id])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setSearch("")
      setLoading(true)
    }
  }

  const onSearchChange = (value: string) => {
    setSearch(value)
    setLoading(true)
  }

  const link = async (transactionId: string) => {
    setLinkingId(transactionId)
    const res = await linkPayslipAction(payslip.id, transactionId)
    setLinkingId(null)
    if (res.ok) {
      toast.success("Payout linked to credit")
      setOpen(false)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="xs">
          <Link2 />
          Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link a bank credit</DialogTitle>
          <DialogDescription>
            Choose the credit that paid the {formatMonth(payslip.periodMonth)} {payslip.employer}{" "}
            payout. Showing credits near that month — search to find any.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search narration, name, or amount…"
            className="h-8 pl-8"
          />
        </div>

        <ScrollArea className="h-72">
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
              <Spinner /> Loading credits…
            </div>
          ) : credits.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center text-sm">
              No matching credits. Try a different search.
            </div>
          ) : (
            <div className="flex flex-col gap-1 pr-2">
              {credits.map((credit) => {
                const isLinking = linkingId === credit.id
                return (
                  <button
                    key={credit.id}
                    type="button"
                    disabled={isLinking}
                    onClick={() => link(credit.id)}
                    className={cn(
                      "hover:bg-muted flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                      "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {credit.counterparty ?? credit.narration}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {formatDate(credit.date)} · {credit.accountName}
                      </p>
                    </div>
                    <Amount value={credit.amount} direction="CREDIT" className="text-sm" />
                    {isLinking ? (
                      <Spinner className="shrink-0" />
                    ) : (
                      <Check className="text-muted-foreground size-4 shrink-0 opacity-0" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
