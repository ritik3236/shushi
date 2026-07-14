import "dotenv/config"

import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"

import { prisma } from "@/lib/prisma"
import { commitImport, previewStatementFile } from "@/lib/services/imports"
import { getDashboardData } from "@/lib/services/analytics"
import { listPayslips } from "@/lib/services/payslips"

// End-to-end pipeline check against the real DB with the real statement files,
// under a throwaway synthetic user that is deleted (cascade) at the end.
// Run: pnpm tsx --conditions=react-server scripts/integration-import.ts

const TEST_EMAIL = "shushi-integration-test@example.local"
const FIXTURES = "test/fixtures"

async function main() {
  const userId = randomUUID()
  await prisma.$executeRaw`
    INSERT INTO neon_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    VALUES (${userId}::uuid, 'Ritik Kushwaha', ${TEST_EMAIL}, true, now(), now())
  `
  console.log(`synthetic user ${userId}`)

  try {
    const statementFiles = readdirSync(FIXTURES)
      .filter((f) => !f.startsWith(".") && f !== "payslips")
      .map((f) => path.join(FIXTURES, f))
    const payslipFiles = readdirSync(path.join(FIXTURES, "payslips"))
      .filter((f) => f.endsWith(".pdf"))
      .map((f) => path.join(FIXTURES, "payslips", f))

    const totals = { files: 0, rows: 0, imported: 0, duplicates: 0, transfers: 0, payslipMatches: 0 }
    for (const file of [...statementFiles, ...payslipFiles]) {
      const buffer = readFileSync(file)
      const preview = await previewStatementFile({
        userId,
        fileName: path.basename(file),
        buffer,
        password: "RITI4257",
      })
      const result = await commitImport(userId, preview.importId)
      totals.files += 1
      totals.rows += preview.totals.rows
      totals.imported += result.imported
      totals.duplicates += result.duplicates
      totals.transfers += result.transfersLinked
      totals.payslipMatches += result.payslipsMatched
      console.log(
        `${path.basename(file)} → ${result.imported} new, ${result.duplicates} dup, +${result.transfersLinked} transfer pairs, +${result.payslipsMatched} payslip matches`
      )
    }
    console.log("\nTOTALS", totals)

    const accounts = await prisma.account.findMany({
      where: { userId },
      include: { _count: { select: { transactions: true } } },
    })
    for (const account of accounts) {
      console.log(`ACCOUNT ${account.name} [${account.accountNumber}] → ${account._count.transactions} txns`)
    }

    const txCount = await prisma.transaction.count({ where: { userId } })
    const categorized = await prisma.transaction.count({
      where: { userId, categoryId: { not: null } },
    })
    const transferLegs = await prisma.transaction.count({
      where: { userId, transferGroupId: { not: null } },
    })
    console.log(
      `TX ${txCount} | categorized ${categorized} (${Math.round((categorized / Math.max(1, txCount)) * 100)}%) | transfer legs ${transferLegs}`
    )

    const dash = await getDashboardData(userId)
    console.log(`DASH months=${dash.months.length} selected=${dash.selected}`)
    console.log("KPIS", dash.kpis)
    console.log(
      "TOP CATEGORIES",
      dash.categoryBreakdown.slice(0, 6).map((c) => `${c.name}: ₹${Math.round(c.amount)}`)
    )
    console.log(
      "ACCOUNT SUMMARIES",
      dash.accounts.map((a) => `${a.name}: bal=${a.balance ?? "-"} due=${a.due ?? "-"}`)
    )

    // Stored-file round-trip: bytes in the DB must hash back to fileHash.
    const { createHash } = await import("node:crypto")
    const storedFiles = await prisma.statementImport.findMany({
      where: { userId },
      select: { fileName: true, fileHash: true, fileData: true, fileSize: true },
    })
    const intact = storedFiles.filter(
      (f) =>
        f.fileData &&
        f.fileSize === f.fileData.length &&
        createHash("sha256").update(Buffer.from(f.fileData)).digest("hex") === f.fileHash
    )
    console.log(`FILES stored ${storedFiles.length}, hash-verified ${intact.length}`)

    const payslips = await listPayslips(userId)
    console.log(
      `PAYSLIPS ${payslips.length} imported, ${payslips.filter((p) => p.matched).length} matched to bank credits`
    )
    for (const p of payslips.filter((p) => p.matched)) {
      console.log(`  matched: ${p.periodMonth} net ₹${p.netPay} → ${p.matched?.accountName} on ${p.matched?.date}`)
    }
  } finally {
    // Scoped cleanup: the FK cascade removes every public-schema row this run created.
    await prisma.$executeRaw`
      DELETE FROM neon_auth."user" WHERE id = ${userId}::uuid AND email = ${TEST_EMAIL}
    `
    console.log("\ncleaned up synthetic user + cascaded data")
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
