import type { Metadata } from "next"
import { Download, FileUp } from "lucide-react"

import { EmptyState } from "@/components/finance/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requirePageUser } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import { listImports, type ImportListRow } from "@/lib/services/imports"

import { HistoryDiscardButton } from "./history-discard-button"
import { UploadCard } from "./upload-card"

export const metadata: Metadata = { title: "Imports" }

const FILE_TYPE_LABEL: Record<ImportListRow["fileType"], string> = {
  AXIS_SAVINGS_CSV: "CSV",
  HDFC_SAVINGS_XLS: "XLS",
  AXIS_CC_XLSX: "CC",
  PAYSLIP_PDF: "PDF",
  CONTRACTOR_FEE_PDF: "PDF",
}

export default async function ImportsPage() {
  const user = await requirePageUser()
  const imports = await listImports(user.id)

  return (
    <>
      <PageHeader
        title="Imports"
        description="Bank statements, credit card statements, payslips — drop them all here."
      />
      <UploadCard />

      {imports.length === 0 ? (
        <EmptyState
          icon={FileUp}
          title="Nothing imported yet"
          hint="Drop a bank statement or payslip into the zone above — every upload lands here with its status."
          className="mt-4"
        />
      ) : (
        <Card size="sm" className="mt-4">
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">File</TableHead>
                  <TableHead className="h-8 text-xs">Type</TableHead>
                  <TableHead className="h-8 text-xs">Account</TableHead>
                  <TableHead className="h-8 text-xs">Period</TableHead>
                  <TableHead className="h-8 text-xs">Rows</TableHead>
                  <TableHead className="h-8 text-xs">Status</TableHead>
                  <TableHead className="h-8 text-right text-xs">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-52">
                      <span className="block truncate font-medium">{row.fileName}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{FILE_TYPE_LABEL[row.fileType]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.accountName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {row.periodStart && row.periodEnd
                        ? `${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {row.status === "PENDING"
                        ? `${row.rowCount} rows`
                        : `${row.importedCount} imported · ${row.duplicateCount} dup`}
                    </TableCell>
                    <TableCell>
                      {row.status === "PENDING" ? (
                        <Badge variant="secondary">pending review</Badge>
                      ) : row.status === "FAILED" ? (
                        <Badge variant="destructive">failed</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {formatDate(row.createdAt)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1">
                        {row.hasFile ? (
                          <Button asChild variant="ghost" size="icon-sm">
                            <a
                              href={`/api/imports/${row.id}/file`}
                              aria-label={`Download ${row.fileName}`}
                            >
                              <Download className="size-3.5" />
                            </a>
                          </Button>
                        ) : null}
                        {row.status === "PENDING" ? (
                          <HistoryDiscardButton importId={row.id} />
                        ) : null}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  )
}
