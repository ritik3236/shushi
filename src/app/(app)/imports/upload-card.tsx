"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleCheck, FileText, FileUp } from "lucide-react"
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
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, formatDayMonth, formatMonth } from "@/lib/format"
import type { CommitResult, ImportPreview } from "@/lib/services/imports"

import {
  commitImportAction,
  discardImportAction,
  uploadStatementAction,
} from "./actions"

type ItemStatus = "analyzing" | "ready" | "importing" | "done" | "error" | "password"

type QueueItem = {
  id: string
  file: File
  name: string
  sizeKB: number
  status: ItemStatus
  preview: ImportPreview | null
  result: CommitResult | null
  error: string | null
  password: string
}

function plural(n: number, singular: string, pluralWord = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralWord}`
}

function summarizeCommit(result: CommitResult): string {
  const parts = [`${result.imported} imported`, plural(result.duplicates, "duplicate")]
  if (result.transfersLinked > 0) parts.push(`${plural(result.transfersLinked, "transfer")} linked`)
  if (result.payslipsMatched > 0) parts.push(`${plural(result.payslipsMatched, "payslip")} matched`)
  return parts.join(" · ")
}

function readyDetail(preview: ImportPreview): string {
  const parts: string[] = []
  if (preview.kind === "PAYSLIP" && preview.payslip) {
    parts.push(preview.payslip.employer)
    parts.push(formatMonth(preview.payslip.periodMonth))
  } else {
    if (preview.account) parts.push(preview.account.name)
    if (preview.periodStart && preview.periodEnd) {
      parts.push(`${formatDate(preview.periodStart)} – ${formatDate(preview.periodEnd)}`)
    }
  }
  parts.push(`${preview.totals.new} new · ${plural(preview.totals.duplicates, "duplicate")}`)
  if (preview.totals.autoCategorized > 0) {
    parts.push(`${preview.totals.autoCategorized} auto-categorized`)
  }
  return parts.join(" · ")
}

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

function ReviewDialog({ preview }: { preview: ImportPreview }) {
  const slip = preview.payslip
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Review
        </Button>
      </DialogTrigger>
      {preview.kind === "PAYSLIP" && slip ? (
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">
              {slip.employer} · {formatMonth(slip.periodMonth)}
            </DialogTitle>
            <DialogDescription className="truncate">
              {slip.kind === "SALARY" ? "Salary payslip" : "Contractor fee statement"} ·{" "}
              {preview.fileName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <BreakdownColumn
              title="Earnings"
              lines={slip.earnings}
              totalLabel="Gross"
              total={slip.grossEarnings}
            />
            <BreakdownColumn
              title="Deductions"
              lines={slip.deductions}
              totalLabel="Total"
              total={slip.totalDeductions}
            />
          </div>
          <Separator />
          <div className="flex items-baseline justify-between text-sm font-medium">
            <span>Net pay</span>
            <Amount value={slip.netPay} signed={false} />
          </div>
        </DialogContent>
      ) : (
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{preview.fileName}</DialogTitle>
            <DialogDescription className="truncate">{readyDetail(preview)}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-80">
            <Table>
              <TableHeader className="bg-popover sticky top-0 z-10">
                <TableRow>
                  <TableHead className="h-8 text-xs">Date</TableHead>
                  <TableHead className="h-8 text-xs">Narration</TableHead>
                  <TableHead className="h-8 text-xs">Category</TableHead>
                  <TableHead className="h-8 text-right text-xs">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row, index) => (
                  <TableRow key={index} className={row.duplicate ? "opacity-50" : undefined}>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDayMonth(row.date)}
                    </TableCell>
                    <TableCell>
                      <span className="flex max-w-56 items-center gap-1.5">
                        <span className="min-w-0 truncate text-xs">
                          {row.counterparty ?? row.narration}
                        </span>
                        {row.duplicate ? (
                          <Badge variant="secondary" className="px-1.5 text-[10px] font-normal">
                            dup
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-40 text-xs">
                      <span className="block truncate">{row.categoryName ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      <Amount value={row.amount} direction={row.direction} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      )}
    </Dialog>
  )
}

export function UploadCard() {
  const router = useRouter()
  const [items, setItems] = useState<QueueItem[]>([])
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null)
  const idRef = useRef(0)
  const pendingRef = useRef<{ id: string; file: File; password?: string }[]>([])
  const pumpingRef = useRef(false)

  function update(id: string, patch: Partial<QueueItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  async function pump() {
    if (pumpingRef.current) return
    pumpingRef.current = true
    try {
      for (let job = pendingRef.current.shift(); job; job = pendingRef.current.shift()) {
        const formData = new FormData()
        formData.set("file", job.file)
        if (job.password) formData.set("password", job.password)
        const res = await uploadStatementAction(formData)
        if (res.ok) {
          update(job.id, { status: "ready", preview: res.data, error: null })
        } else if (res.passwordRequired) {
          update(job.id, { status: "password", error: res.error })
        } else {
          update(job.id, { status: "error", error: res.error })
        }
      }
    } finally {
      pumpingRef.current = false
    }
  }

  function addFiles(list: FileList | File[]) {
    const files = Array.from(list)
    if (!files.length) return
    const fresh = files.map((file) => {
      idRef.current += 1
      return {
        id: `file-${idRef.current}`,
        file,
        name: file.name,
        sizeKB: Math.max(1, Math.round(file.size / 1024)),
        status: "analyzing" as const,
        preview: null,
        result: null,
        error: null,
        password: "",
      }
    })
    setItems((prev) => [...prev, ...fresh])
    pendingRef.current.push(...fresh.map(({ id, file }) => ({ id, file })))
    void pump()
  }

  async function commitItem(
    id: string,
    preview: ImportPreview,
    opts?: { silent?: boolean }
  ): Promise<CommitResult | null> {
    update(id, { status: "importing" })
    const res = await commitImportAction(preview.importId)
    if (!res.ok) {
      update(id, { status: "ready" })
      toast.error(res.error)
      return null
    }
    update(id, { status: "done", result: res.data })
    if (!opts?.silent) {
      toast.success(`${preview.fileName}: ${summarizeCommit(res.data)}`)
      router.refresh()
    }
    return res.data
  }

  async function importAll() {
    const ready = items.filter(
      (item): item is QueueItem & { preview: ImportPreview } =>
        item.status === "ready" && item.preview !== null
    )
    if (!ready.length) {
      toast.error("Nothing is ready to import yet.")
      return
    }
    setBulk({ done: 0, total: ready.length })
    let okFiles = 0
    let imported = 0
    for (const item of ready) {
      const result = await commitItem(item.id, item.preview, { silent: true })
      if (result) {
        okFiles += 1
        imported += result.imported
      }
      setBulk((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev))
    }
    setBulk(null)
    toast.success(`Imported ${okFiles} of ${plural(ready.length, "file")} · ${imported} transactions`)
    router.refresh()
  }

  async function discardItem(id: string, importId: string) {
    const res = await discardImportAction(importId)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setItems((prev) => prev.filter((item) => item.id !== id))
    toast.success("Import discarded.")
    router.refresh()
  }

  function retry(item: QueueItem, password?: string) {
    update(item.id, { status: "analyzing", error: null })
    pendingRef.current.push({ id: item.id, file: item.file, password })
    void pump()
  }

  function unlock(item: QueueItem) {
    const password = item.password.trim()
    if (!password) {
      toast.error("Enter the statement password first.")
      return
    }
    retry(item, password)
  }

  const readyCount = items.filter((item) => item.status === "ready").length

  return (
    <div>
      <label
        htmlFor="import-files"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          addFiles(event.dataTransfer.files)
        }}
        className="hover:bg-muted/50 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-6 text-center transition-colors"
      >
        <FileUp className="text-muted-foreground size-5" />
        <span className="text-sm font-medium">Choose files or drag them here</span>
        <span className="text-muted-foreground text-xs">
          Bank and credit card statements (.csv, .xls, .xlsx) or payslip PDFs — up to 15 MB each
        </span>
        <input
          id="import-files"
          type="file"
          multiple
          accept=".csv,.xls,.xlsx,.pdf"
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files ?? [])
            event.target.value = ""
          }}
        />
      </label>

      {readyCount >= 2 ? (
        <div className="mt-3 flex justify-end">
          <Button size="sm" disabled={bulk !== null} onClick={() => void importAll()}>
            {bulk
              ? `Importing ${Math.min(bulk.done + 1, bulk.total)}/${bulk.total}…`
              : `Import all (${readyCount})`}
          </Button>
        </div>
      ) : null}

      {items.length ? (
        <ul className="divide-y">
          {items.map((item) => {
            const preview = item.preview
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <FileText className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="max-w-64 truncate text-sm font-medium">{item.name}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {item.sizeKB} KB
                      </span>
                      {item.status === "ready" && preview?.account && !preview.account.exists ? (
                        <Badge variant="secondary">new account</Badge>
                      ) : null}
                      {item.status === "ready" && preview?.duplicateFile ? (
                        <Badge variant="secondary" className="bg-warning/10 text-warning">
                          identical file already imported
                        </Badge>
                      ) : null}
                    </div>
                    {item.status === "analyzing" ? (
                      <p className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Spinner className="size-3" />
                        Analyzing…
                      </p>
                    ) : null}
                    {item.status === "importing" ? (
                      <p className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Spinner className="size-3" />
                        Importing…
                      </p>
                    ) : null}
                    {item.status === "ready" && preview ? (
                      <p className="text-muted-foreground truncate text-xs">
                        {readyDetail(preview)}
                      </p>
                    ) : null}
                    {item.status === "done" && item.result ? (
                      <p className="text-success text-xs">{summarizeCommit(item.result)}</p>
                    ) : null}
                    {(item.status === "error" || item.status === "password") && item.error ? (
                      <p className="text-destructive text-xs">{item.error}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {item.status === "ready" && preview ? (
                    <>
                      <ReviewDialog preview={preview} />
                      <Button
                        size="sm"
                        disabled={bulk !== null}
                        onClick={() => void commitItem(item.id, preview)}
                      >
                        Import
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={bulk !== null}
                        onClick={() => void discardItem(item.id, preview.importId)}
                      >
                        Discard
                      </Button>
                    </>
                  ) : null}
                  {item.status === "password" ? (
                    <>
                      <Input
                        type="password"
                        placeholder="Password"
                        aria-label={`Password for ${item.name}`}
                        className="h-8 w-36"
                        value={item.password}
                        onChange={(event) => update(item.id, { password: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") unlock(item)
                        }}
                      />
                      <Button size="sm" onClick={() => unlock(item)}>
                        Unlock
                      </Button>
                    </>
                  ) : null}
                  {item.status === "error" ? (
                    <Button variant="outline" size="sm" onClick={() => retry(item)}>
                      Retry
                    </Button>
                  ) : null}
                  {item.status === "done" ? (
                    <CircleCheck className="text-success size-4" aria-hidden />
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
