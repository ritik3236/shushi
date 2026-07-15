"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatMonth } from "@/lib/format"

import { deletePayslipAction } from "./actions"

/** Delete a payslip (e.g. a duplicate). The matched credit is left untouched. */
export function PayslipDeleteButton({
  payslipId,
  periodMonth,
  employer,
}: {
  payslipId: string
  periodMonth: string
  employer: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const confirm = () =>
    startTransition(async () => {
      const res = await deletePayslipAction(payslipId)
      if (res.ok) {
        toast.success("Payslip deleted")
        setOpen(false)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Delete payslip"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete this payslip?</DialogTitle>
          <DialogDescription>
            Remove the {formatMonth(periodMonth)} {employer} payslip. Any matched bank credit and
            its category stay as they are. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={confirm} disabled={pending}>
            {pending ? <Spinner /> : <Trash2 />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
