"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Wand2 } from "lucide-react"
import { toast } from "sonner"

import { CategorySelect } from "@/components/finance/category-select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { CategoryOption } from "@/lib/services/categories"

import { createRuleAction } from "./actions"

type Field = "NARRATION" | "COUNTERPARTY"

const FIELDS: { value: Field; label: string }[] = [
  { value: "NARRATION", label: "Narration" },
  { value: "COUNTERPARTY", label: "Counterparty" },
]

export function NewRuleDialog({ options }: { options: CategoryOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pattern, setPattern] = useState("")
  const [field, setField] = useState<Field>("NARRATION")
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [applyToExisting, setApplyToExisting] = useState(true)
  const [busy, setBusy] = useState(false)

  function reset() {
    setPattern("")
    setField("NARRATION")
    setCategoryId(null)
    setApplyToExisting(true)
  }

  async function create() {
    if (pattern.trim().length < 3) {
      toast.error("Pattern must be at least 3 characters.")
      return
    }
    if (!categoryId) {
      toast.error("Pick a category.")
      return
    }
    setBusy(true)
    const result = await createRuleAction({
      pattern: pattern.trim(),
      field,
      categoryId,
      applyToExisting,
    })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Rule created · ${result.data.applied} transactions categorized`)
    setOpen(false)
    reset()
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Wand2 /> New rule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New auto-rule</DialogTitle>
          <DialogDescription>
            Transactions whose field contains this keyword get the category — on future imports too.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="new-rule-pattern">Keyword</Label>
            <Input
              id="new-rule-pattern"
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              placeholder="e.g. SWIGGY"
              className="h-8"
              onKeyDown={(event) => {
                if (event.key === "Enter") void create()
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Match on</Label>
              <Select value={field} onValueChange={(value) => setField(value as Field)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELDS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <CategorySelect
                options={options}
                value={categoryId}
                onChange={setCategoryId}
                allowClear={false}
                placeholder="Pick category"
                className="h-8 w-full text-sm"
              />
            </div>
          </div>
          <label
            htmlFor="new-rule-apply"
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
          >
            <span className="text-sm">
              Apply to existing uncategorized
              <span className="text-muted-foreground block text-xs font-normal">
                Categorize matching transactions you already have.
              </span>
            </span>
            <Switch
              id="new-rule-apply"
              checked={applyToExisting}
              onCheckedChange={setApplyToExisting}
            />
          </label>
        </div>
        <DialogFooter>
          <Button size="sm" disabled={busy} onClick={() => void create()}>
            {busy ? "Creating…" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
