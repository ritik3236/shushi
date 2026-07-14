"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
import { cn } from "@/lib/utils"

import { createCategoryAction } from "./actions"

type Kind = "EXPENSE" | "INCOME" | "TRANSFER"

const KINDS: { value: Kind; label: string }[] = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfer" },
]

const COLORS = Array.from({ length: 8 }, (_, i) => `chart-${i + 1}`)

export function NewCategoryDialog({
  parents,
}: {
  parents: { id: string; name: string; kind: Kind }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [kind, setKind] = useState<Kind>("EXPENSE")
  const [parentId, setParentId] = useState("top")
  const [color, setColor] = useState("chart-1")
  const [busy, setBusy] = useState(false)

  const parentOptions = parents.filter((parent) => parent.kind === kind)

  async function create() {
    if (!name.trim()) {
      toast.error("Name is required.")
      return
    }
    setBusy(true)
    const result = await createCategoryAction({
      name: name.trim(),
      kind,
      parentId: parentId === "top" ? null : parentId,
      color,
    })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Category created.")
    setOpen(false)
    setName("")
    setParentId("top")
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> New category
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="new-category-name">Name</Label>
            <Input
              id="new-category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Groceries"
              className="h-8"
              onKeyDown={(event) => {
                if (event.key === "Enter") void create()
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Kind</Label>
              <Select
                value={kind}
                onValueChange={(value) => {
                  setKind(value as Kind)
                  setParentId("top")
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Parent</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top level</SelectItem>
                  {parentOptions.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Color</Label>
            <div className="flex items-center gap-1.5">
              {COLORS.map((token, index) => (
                <button
                  key={token}
                  type="button"
                  aria-label={`Color ${index + 1}`}
                  aria-pressed={color === token}
                  onClick={() => setColor(token)}
                  className={cn(
                    "ring-offset-popover size-5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    color === token && "ring-2 ring-ring ring-offset-2"
                  )}
                  style={{ background: `var(--${token})` }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" disabled={busy} onClick={() => void create()}>
            {busy ? "Creating…" : "Create category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
