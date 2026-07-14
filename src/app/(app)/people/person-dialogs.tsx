"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2, UserPlus } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { createPersonAction, deletePersonAction, updatePersonAction } from "./actions"

type PersonForm = { id?: string; name: string; note: string }

function PersonDialog({
  open,
  onOpenChange,
  initial,
  assignCounterparty,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial?: { id: string; name: string; note: string | null }
  /** When registering from a suggestion — assign this counterparty's rows. */
  assignCounterparty?: string
}) {
  const router = useRouter()
  // A prefilled suggestion passes an empty id → still a "create".
  const editing = Boolean(initial?.id)
  const [form, setForm] = useState<PersonForm>({
    id: initial?.id || undefined,
    name: initial?.name ?? "",
    note: initial?.note ?? "",
  })
  const [pending, start] = useTransition()

  const submit = () =>
    start(async () => {
      if (!form.name.trim()) {
        toast.error("Give this person a name.")
        return
      }
      if (editing && form.id) {
        const res = await updatePersonAction(form.id, { name: form.name, note: form.note })
        if (res.ok) {
          toast.success("Saved")
          onOpenChange(false)
          router.refresh()
        } else {
          toast.error(res.error)
        }
      } else {
        const res = await createPersonAction({
          name: form.name,
          note: form.note,
          assignCounterparty,
        })
        if (res.ok) {
          toast.success(
            res.data.assigned > 0
              ? `${form.name.trim()} added · ${res.data.assigned} transactions assigned`
              : `${form.name.trim()} added`
          )
          onOpenChange(false)
          router.refresh()
        } else {
          toast.error(res.error)
        }
      }
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit person" : "New person"}</DialogTitle>
          <DialogDescription>
            {assignCounterparty
              ? `Every transaction from “${assignCounterparty}” will be assigned to this person.`
              : "Register a person, then assign their transactions from the transaction row."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="person-name" className="text-xs">
              Name
            </Label>
            <Input
              id="person-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Ziya"
              className="h-8"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="person-note" className="text-xs">
              Note (optional)
            </Label>
            <Input
              id="person-note"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="e.g. cousin"
              className="h-8"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {editing ? "Save" : "Add person"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** "New person" button — also used to prefill from a counterparty suggestion. */
export function NewPersonButton({
  prefill,
  assignCounterparty,
  variant = "default",
  size = "sm",
  children,
}: {
  prefill?: { name: string }
  assignCounterparty?: string
  variant?: "default" | "outline" | "ghost"
  size?: "sm" | "xs"
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {children ?? (
          <>
            <Plus /> New person
          </>
        )}
      </Button>
      {open ? (
        <PersonDialog
          open={open}
          onOpenChange={setOpen}
          initial={prefill ? { id: "", name: prefill.name, note: null } : undefined}
          assignCounterparty={assignCounterparty}
        />
      ) : null}
    </>
  )
}

export function PersonRowActions({
  person,
}: {
  person: { id: string; name: string; note: string | null }
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, start] = useTransition()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${person.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editOpen ? (
        <PersonDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          initial={{ id: person.id, name: person.name, note: person.note }}
        />
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {person.name}?</DialogTitle>
            <DialogDescription>
              Removes this person. Their transactions stay — they&apos;re just unassigned from the
              ledger.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deletePersonAction(person.id)
                  if (res.ok) {
                    toast.success("Deleted")
                    setConfirmOpen(false)
                    router.refresh()
                  } else {
                    toast.error(res.error)
                  }
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** A counterparty suggestion → opens the new-person dialog prefilled. */
export function SuggestionAdd({ name }: { name: string }) {
  return (
    <NewPersonButton prefill={{ name }} assignCounterparty={name} variant="ghost" size="xs">
      <UserPlus /> Add
    </NewPersonButton>
  )
}
