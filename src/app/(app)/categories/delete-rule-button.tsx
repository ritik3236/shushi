"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
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

import { deleteRuleAction } from "./actions"

export function DeleteRuleButton({ ruleId, pattern }: { ruleId: string; pattern: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function remove() {
    setBusy(true)
    const result = await deleteRuleAction(ruleId)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Rule deleted.")
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button variant="ghost" size="icon-xs" aria-label="Delete rule" onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this rule?</DialogTitle>
            <DialogDescription>
              <span className="font-mono">“{pattern}”</span> will stop categorizing new imports.
              Existing transactions keep their category.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => void remove()}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
