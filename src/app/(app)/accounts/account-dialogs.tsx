"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatINR } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { AccountSummary } from "@/lib/services/analytics"

import { updateAccountAction } from "./actions"

const CHART_COLORS = [
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6", "chart-7", "chart-8",
] as const

/** Strip a trailing ".00"/zero so the field seeds clean; blank when unset. */
function seedMoney(value: string | null): string {
  if (!value || Number(value) === 0) return ""
  return String(Number(value))
}

export function AccountEditButton({ account }: { account: AccountSummary }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${account.name}`}
        onClick={() => setOpen(true)}
      >
        <Pencil />
      </Button>
      {open ? <AccountEditDialog account={account} open={open} onOpenChange={setOpen} /> : null}
    </>
  )
}

function AccountEditDialog({
  account,
  open,
  onOpenChange,
}: {
  account: AccountSummary
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const router = useRouter()
  const isCard = account.type === "CREDIT_CARD"
  // Opening balance only matters where there's no statement running balance.
  const balanceless = account.type === "SAVINGS" && !account.hasStatementBalance

  const [name, setName] = useState(account.name)
  const [color, setColor] = useState<string | null>(account.color)
  const [creditLimit, setCreditLimit] = useState(seedMoney(account.creditLimit))
  const [opening, setOpening] = useState(seedMoney(account.openingBalance))
  const [pending, start] = useTransition()

  const openingNum = Number(opening || "0")
  const openingValid = opening.trim() === "" || Number.isFinite(openingNum)
  const resultingBalance =
    balanceless && account.net !== null && openingValid ? Number(account.net) + openingNum : null

  const submit = () =>
    start(async () => {
      if (!name.trim()) {
        toast.error("Give the account a name.")
        return
      }
      if (!openingValid) {
        toast.error("Opening balance must be a number.")
        return
      }
      const res = await updateAccountAction(account.id, {
        name,
        color,
        ...(isCard ? { creditLimit: creditLimit.trim() === "" ? null : creditLimit.trim() } : {}),
        ...(balanceless ? { openingBalance: opening.trim() === "" ? "0" : opening.trim() } : {}),
      })
      if (res.ok) {
        toast.success("Saved")
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit account</DialogTitle>
          <DialogDescription>
            {account.bank} · {account.accountNumber}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="acct-name" className="text-xs">
              Name
            </Label>
            <Input
              id="acct-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Colour</Label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-label="No colour"
                aria-pressed={color === null}
                onClick={() => setColor(null)}
                className={cn(
                  "border-muted-foreground/40 ring-offset-background size-6 rounded-full border border-dashed transition-all",
                  color === null && "ring-primary ring-2 ring-offset-1"
                )}
              />
              {CHART_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "ring-offset-background size-6 rounded-full transition-all",
                    color === c && "ring-primary ring-2 ring-offset-1"
                  )}
                  style={{ background: `var(--${c})` }}
                />
              ))}
            </div>
          </div>

          {isCard ? (
            <div className="space-y-1.5">
              <Label htmlFor="acct-limit" className="text-xs">
                Credit limit
              </Label>
              <Input
                id="acct-limit"
                inputMode="numeric"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="e.g. 200000"
                className="h-8"
              />
            </div>
          ) : null}

          {balanceless ? (
            <div className="space-y-1.5">
              <Label htmlFor="acct-opening" className="text-xs">
                Opening balance
              </Label>
              <Input
                id="acct-opening"
                inputMode="text"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                placeholder="0"
                className="h-8"
              />
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                This import had no running balance — set the balance at the start of your records so
                it can track forward.
                {resultingBalance !== null ? (
                  <>
                    {" "}
                    Balance shows as{" "}
                    <span className="text-foreground font-medium">{formatINR(resultingBalance)}</span>.
                  </>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
