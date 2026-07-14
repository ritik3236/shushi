"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import { discardImportAction } from "./actions"

/** Discards a still-PENDING import from the history table. */
export function HistoryDiscardButton({ importId }: { importId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        const res = await discardImportAction(importId)
        setBusy(false)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success("Import discarded.")
        router.refresh()
      }}
    >
      {busy ? "Discarding…" : "Discard"}
    </Button>
  )
}
