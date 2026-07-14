import "dotenv/config"

import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { prisma } from "@/lib/prisma"
import { commitImport, previewStatementFile } from "@/lib/services/imports"
import { getDashboardData } from "@/lib/services/analytics"
import { listPayslips } from "@/lib/services/payslips"

// Load every real statement/payslip in test/fixtures into an EXISTING user
// account (created via the app's sign-up). Persistent — unlike the integration
// script, it never deletes anything. Target the account by email:
//   pnpm tsx --conditions=react-server scripts/import-my-files.ts <email>

const FIXTURES = "test/fixtures"
const FILE_PASSWORD = "RITI4257"

async function main() {
  const email = process.argv[2]
  if (!email) throw new Error("Usage: import-my-files.ts <account-email>")

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error(`No user with email ${email}. Sign up in the app first.`)
  console.log(`Target account: ${user.email} (${user.id})`)

  // Clean slate: remove this account's existing app data so the re-import is
  // exact. Scoped to this user id only; the account itself and the system
  // categories/rules are untouched.
  const [ps, tx, si, ac] = await prisma.$transaction([
    prisma.payslip.deleteMany({ where: { userId: user.id } }),
    prisma.transaction.deleteMany({ where: { userId: user.id } }),
    prisma.statementImport.deleteMany({ where: { userId: user.id } }),
    prisma.account.deleteMany({ where: { userId: user.id } }),
  ])
  console.log(
    `Reset: cleared ${tx.count} transactions, ${ac.count} accounts, ${si.count} imports, ${ps.count} payslips\n`
  )

  const statementFiles = readdirSync(FIXTURES)
    .filter((f) => !f.startsWith(".") && f !== "payslips")
    .map((f) => path.join(FIXTURES, f))
  const payslipFiles = readdirSync(path.join(FIXTURES, "payslips"))
    .filter((f) => f.endsWith(".pdf"))
    .map((f) => path.join(FIXTURES, "payslips", f))

  const totals = { files: 0, imported: 0, duplicates: 0, transfers: 0, payslipMatches: 0 }
  for (const file of [...statementFiles, ...payslipFiles]) {
    const buffer = readFileSync(file)
    const preview = await previewStatementFile({
      userId: user.id,
      fileName: path.basename(file),
      buffer,
      password: FILE_PASSWORD,
    })
    const result = await commitImport(user.id, preview.importId)
    totals.files += 1
    totals.imported += result.imported
    totals.duplicates += result.duplicates
    totals.transfers += result.transfersLinked
    totals.payslipMatches += result.payslipsMatched
    console.log(
      `${path.basename(file)} → ${result.imported} new, ${result.duplicates} dup` +
        (result.transfersLinked ? `, +${result.transfersLinked} transfers` : "") +
        (result.payslipsMatched ? `, +${result.payslipsMatched} payslip matches` : "")
    )
  }

  console.log("\nTOTALS", totals)

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    include: { _count: { select: { transactions: true } } },
  })
  for (const account of accounts) {
    console.log(`ACCOUNT ${account.name} → ${account._count.transactions} txns`)
  }

  const dash = await getDashboardData(user.id)
  console.log(`\nDASH months=${dash.months.length} latest=${dash.selected}`)
  const payslips = await listPayslips(user.id)
  console.log(
    `PAYSLIPS ${payslips.length} imported, ${payslips.filter((p) => p.matched).length} matched`
  )

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
