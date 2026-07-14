import "dotenv/config"

import { readFileSync } from "node:fs"
import path from "node:path"

import { prisma } from "@/lib/prisma"
import { commitImport, previewStatementFile } from "@/lib/services/imports"

// Additive import of one or more payslip PDFs into an existing account. Never
// resets. Idempotent — a slip already present (by content hash) is skipped.
//   pnpm tsx --conditions=react-server scripts/import-payslips.ts <email> <pdf...>

async function main() {
  const [email, ...files] = process.argv.slice(2)
  if (!email || files.length === 0) throw new Error("Usage: import-payslips.ts <email> <pdf...>")

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error(`No user with email ${email}. Sign up in the app first.`)
  console.log(`Target: ${user.email} (${user.id})\n`)

  let matchedTotal = 0
  for (const file of files) {
    const buffer = readFileSync(file)
    const preview = await previewStatementFile({
      userId: user.id,
      fileName: path.basename(file),
      buffer,
    })
    if (preview.kind !== "PAYSLIP" || !preview.payslip) {
      console.log(`  ! ${path.basename(file)} — not a payslip (${preview.kind}), skipped`)
      continue
    }
    const result = await commitImport(user.id, preview.importId)
    matchedTotal = result.payslipsMatched
    const p = preview.payslip
    console.log(
      `  ${result.imported ? "✓ imported" : "· already had"}  ${p.periodMonth} ${p.kind}` +
        ` gross ₹${p.grossEarnings} net ₹${p.netPay}  <- ${path.basename(file)}`
    )
  }
  console.log(`\nPayslips matched to bank credits after import: ${matchedTotal}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
