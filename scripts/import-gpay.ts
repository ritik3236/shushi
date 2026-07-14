import "dotenv/config"

import { readFileSync } from "node:fs"
import path from "node:path"

import { prisma } from "@/lib/prisma"
import { parseStatementFile } from "@/lib/imports/detect"
import { commitImport, previewStatementFile } from "@/lib/services/imports"

// Additive import of a Google Pay transaction statement — pulls ONLY the Union
// Bank account (the one with no bank statement of its own). Never resets; safe
// to run against a live account. Dry-run by default; pass --commit to write.
//   pnpm tsx --conditions=react-server scripts/import-gpay.ts <email> <pdf> [--commit]

async function main() {
  const email = process.argv[2]
  const file = process.argv[3]
  const doCommit = process.argv.includes("--commit")
  if (!email || !file) throw new Error("Usage: import-gpay.ts <email> <pdf> [--commit]")

  const buffer = readFileSync(file)

  // Dry-run: parse and summarize the Union Bank ledger before touching the DB.
  const parsed = await parseStatementFile(buffer)
  if (parsed.kind !== "STATEMENT") throw new Error("Not a statement PDF")
  const txns = parsed.transactions
  const sum = (dir: "DEBIT" | "CREDIT") =>
    txns.filter((t) => t.direction === dir).reduce((s, t) => s + Number(t.amount), 0)
  console.log(`\n=== ${parsed.account.name} (${parsed.account.accountNumber}) ===`)
  console.log(`period: ${parsed.periodStart} … ${parsed.periodEnd}`)
  console.log(`rows: ${txns.length}`)
  console.log(`  debits : ${txns.filter((t) => t.direction === "DEBIT").length}  ₹${sum("DEBIT").toFixed(2)}`)
  console.log(`  credits: ${txns.filter((t) => t.direction === "CREDIT").length}  ₹${sum("CREDIT").toFixed(2)}`)
  const transfers = txns.filter((t) => /^Self transfer/.test(t.narration))
  console.log(`  self-transfers: ${transfers.length}`)
  transfers.forEach((t) => console.log(`    ${t.date} ${t.direction} ₹${t.amount} — ${t.narration}`))
  console.log("\nfirst 5 rows:")
  txns.slice(0, 5).forEach((t) => console.log(`  ${t.date} ${t.direction} ₹${t.amount} ${t.narration} [${t.refNo}]`))

  if (!doCommit) {
    console.log("\n(dry-run — pass --commit to import)")
    return
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error(`No user with email ${email}. Sign up in the app first.`)
  console.log(`\nImporting into ${user.email} (${user.id})…`)

  const preview = await previewStatementFile({
    userId: user.id,
    fileName: path.basename(file),
    buffer,
  })
  console.log(
    `preview: ${preview.totals.rows} rows, ${preview.totals.new} new, ` +
      `${preview.totals.duplicates} dup, ${preview.totals.autoCategorized} auto-categorized`
  )
  const result = await commitImport(user.id, preview.importId)
  console.log(
    `committed: ${result.imported} imported, ${result.duplicates} duplicates, ` +
      `${result.transfersLinked} transfers linked, account ${result.accountId}`
  )
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
