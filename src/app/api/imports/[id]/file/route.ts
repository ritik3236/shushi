import type { ImportFileType } from "@prisma/client"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Download the original uploaded statement file (stored as bytea on the
// import row). Owner-gated; bytes are served exactly as uploaded.

const MIME_BY_TYPE: Record<ImportFileType, string> = {
  AXIS_SAVINGS_CSV: "text/csv",
  HDFC_SAVINGS_XLS: "application/vnd.ms-excel",
  AXIS_CC_XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  GPAY_STATEMENT_PDF: "application/pdf",
  PAYSLIP_PDF: "application/pdf",
  CONTRACTOR_FEE_PDF: "application/pdf",
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { id } = await context.params
  const row = await prisma.statementImport.findFirst({
    where: { id, userId: user.id },
    select: { fileData: true, fileName: true, fileType: true },
  })
  if (!row?.fileData) return new Response("File not found", { status: 404 })

  const asciiName = row.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'")
  return new Response(Buffer.from(row.fileData), {
    headers: {
      "Content-Type": MIME_BY_TYPE[row.fileType] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  })
}
