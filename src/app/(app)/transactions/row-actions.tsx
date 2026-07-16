"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Amount } from "@/components/finance/amount"
import { CategorySelect } from "@/components/finance/category-select"
import { TransferBadge } from "@/components/finance/transfer-badge"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import type { ActionResult } from "@/lib/actions"
import { formatDate } from "@/lib/format"
import type { CategoryOption } from "@/lib/services/categories"
import type { TransactionRow } from "@/lib/services/transactions"

import {
  assignPersonAction,
  createRuleAction,
  setExcludedAction,
  setTagsAction,
  unlinkTransferAction,
} from "./actions"
import { TagInput } from "./tag-input"

const NONE = "__none__"

export function RowActions({
  row,
  categoryOptions,
  tagSuggestions,
  people,
}: {
  row: TransactionRow
  categoryOptions: CategoryOption[]
  tagSuggestions: string[]
  people: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [ruleOpen, setRuleOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tags, setTags] = useState<string[]>(row.tags)
  const [assignOpen, setAssignOpen] = useState(false)
  const [personSel, setPersonSel] = useState<string>(row.person?.id ?? NONE)
  const [newPersonName, setNewPersonName] = useState("")
  const [, startMenuAction] = useTransition()
  const [ruleBusy, startRuleAction] = useTransition()
  const [tagsBusy, startTagsAction] = useTransition()
  const [assignBusy, startAssignAction] = useTransition()

  // Rule form, prefilled from the row.
  const [pattern, setPattern] = useState(row.counterparty ?? row.narration.slice(0, 30))
  const [field, setField] = useState<"NARRATION" | "COUNTERPARTY">(
    row.counterparty ? "COUNTERPARTY" : "NARRATION"
  )
  const [ruleCategory, setRuleCategory] = useState<string | null>(row.category?.id ?? null)
  const [applyToExisting, setApplyToExisting] = useState(true)

  const transferGroupId = row.transferGroupId

  function runMenuAction(action: () => Promise<ActionResult>, successMessage: string) {
    startMenuAction(async () => {
      const result = await action()
      if (result.ok) {
        toast.success(successMessage)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function openTags() {
    setTags(row.tags)
    setTagsOpen(true)
  }

  function saveTags() {
    startTagsAction(async () => {
      const result = await setTagsAction(row.id, tags)
      if (result.ok) {
        toast.success("Tags saved")
        setTagsOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function openAssign() {
    setPersonSel(row.person?.id ?? NONE)
    setNewPersonName("")
    setAssignOpen(true)
  }

  function saveAssign() {
    const newName = newPersonName.trim()
    startAssignAction(async () => {
      const result = await assignPersonAction({
        transactionId: row.id,
        ...(newName ? { newName } : { personId: personSel === NONE ? null : personSel }),
      })
      if (result.ok) {
        toast.success(
          newName ? `Assigned to ${newName}` : personSel === NONE ? "Unassigned" : "Assigned"
        )
        setAssignOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function submitRule() {
    const trimmed = pattern.trim()
    if (trimmed.length < 3) {
      toast.error("Pattern must be at least 3 characters.")
      return
    }
    if (!ruleCategory) {
      toast.error("Pick a category for the rule.")
      return
    }
    startRuleAction(async () => {
      const result = await createRuleAction({
        pattern: trimmed,
        field,
        categoryId: ruleCategory,
        applyToExisting,
      })
      if (result.ok) {
        const applied = result.data.applied
        toast.success(
          applied > 0
            ? `Rule created · ${applied} transaction${applied === 1 ? "" : "s"} categorized`
            : "Rule created"
        )
        setRuleOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Row actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setDetailsOpen(true)}>View details</DropdownMenuItem>
          <DropdownMenuItem onSelect={openAssign}>
            {row.person ? `Person: ${row.person.name}…` : "Assign to person…"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openTags}>Tags…</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRuleOpen(true)}>
            Always categorize like this…
          </DropdownMenuItem>
          {/* Khata (person-assigned) and transfer-kind rows are already out of
              spend, so the toggle would be a no-op — only show it where it acts. */}
          {(row.person === null && row.category?.kind !== "TRANSFER") || transferGroupId ? (
            <DropdownMenuSeparator />
          ) : null}
          {row.person === null && row.category?.kind !== "TRANSFER" ? (
            <DropdownMenuItem
              onSelect={() =>
                runMenuAction(
                  () => setExcludedAction(row.id, !row.excludeFromSpend),
                  row.excludeFromSpend ? "Included in spend" : "Excluded from spend"
                )
              }
            >
              {row.excludeFromSpend ? "Include in spend" : "Exclude from spend"}
            </DropdownMenuItem>
          ) : null}
          {transferGroupId ? (
            <DropdownMenuItem
              onSelect={() =>
                runMenuAction(() => unlinkTransferAction(transferGroupId), "Transfer unlinked")
              }
            >
              Unlink transfer
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction details</DialogTitle>
            <DialogDescription>
              {formatDate(row.date)} · {row.account.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Narration</p>
              <p className="break-words">{row.narration}</p>
            </div>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5">
              <dt className="text-muted-foreground">Amount</dt>
              <dd>
                <Amount value={row.amount} direction={row.direction} />
              </dd>
              <dt className="text-muted-foreground">Date</dt>
              <dd>{formatDate(row.date)}</dd>
              <dt className="text-muted-foreground">Account</dt>
              <dd>
                {row.account.name}
                <span className="text-muted-foreground"> · {row.account.bank}</span>
              </dd>
              {row.channel ? (
                <>
                  <dt className="text-muted-foreground">Channel</dt>
                  <dd>{row.channel}</dd>
                </>
              ) : null}
              {row.refNo ? (
                <>
                  <dt className="text-muted-foreground">Ref no</dt>
                  <dd className="font-mono text-xs leading-5 break-all">{row.refNo}</dd>
                </>
              ) : null}
              {row.balanceAfter ? (
                <>
                  <dt className="text-muted-foreground">Balance after</dt>
                  <dd>
                    <Amount value={row.balanceAfter} />
                  </dd>
                </>
              ) : null}
              {row.transferKind ? (
                <>
                  <dt className="text-muted-foreground">Transfer</dt>
                  <dd>
                    <TransferBadge kind={row.transferKind} />
                  </dd>
                </>
              ) : null}
              {row.notes ? (
                <>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="break-words">{row.notes}</dd>
                </>
              ) : null}
            </dl>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tags</DialogTitle>
            <DialogDescription>
              Type a tag and press Enter. Tags are lowercased; up to 8 per transaction.
            </DialogDescription>
          </DialogHeader>
          <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} id={`tags-${row.id}`} />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTagsOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveTags} disabled={tagsBusy}>
              {tagsBusy ? "Saving…" : "Save tags"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to person</DialogTitle>
            <DialogDescription>
              Roll this transaction up under a person on the People page. Pick someone, or add a
              new person.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {people.length ? (
              <div className="space-y-1.5">
                <Label htmlFor={`person-${row.id}`}>Person</Label>
                <Select
                  value={personSel}
                  onValueChange={(v) => {
                    setPersonSel(v)
                    setNewPersonName("")
                  }}
                >
                  <SelectTrigger id={`person-${row.id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None (unassigned)</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor={`new-person-${row.id}`}>
                {people.length ? "Or add a new person" : "New person"}
              </Label>
              <Input
                id={`new-person-${row.id}`}
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="e.g. Ziya"
                className="h-8"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveAssign} disabled={assignBusy}>
              {assignBusy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Always categorize like this</DialogTitle>
            <DialogDescription>
              Future matching transactions get this category automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`rule-pattern-${row.id}`}>Pattern</Label>
              <Input
                id={`rule-pattern-${row.id}`}
                value={pattern}
                onChange={(event) => setPattern(event.target.value)}
                className="h-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={field}
                onValueChange={(value) => setField(value as "NARRATION" | "COUNTERPARTY")}
              >
                <SelectTrigger className="w-36 shrink-0" aria-label="Match field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NARRATION">Narration</SelectItem>
                  <SelectItem value="COUNTERPARTY">Counterparty</SelectItem>
                </SelectContent>
              </Select>
              <CategorySelect
                options={categoryOptions}
                value={ruleCategory}
                onChange={setRuleCategory}
                allowClear={false}
                className="h-8 min-w-0 flex-1"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Switch
                id={`rule-apply-${row.id}`}
                size="sm"
                checked={applyToExisting}
                onCheckedChange={setApplyToExisting}
              />
              <Label
                htmlFor={`rule-apply-${row.id}`}
                className="text-muted-foreground text-xs font-normal"
              >
                Apply to existing uncategorized
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRuleOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitRule} disabled={ruleBusy}>
              {ruleBusy ? "Creating…" : "Create rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
