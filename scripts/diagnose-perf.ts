import "dotenv/config"

import { prisma } from "@/lib/prisma"
import {
  listTransactions,
  listTransactionMonths,
} from "@/lib/services/transactions"
import { getAccountSummaries } from "@/lib/services/analytics"
import { getCategoryOptions } from "@/lib/services/categories"

// Time each data call the /transactions page makes, plus DB state checks, to
// separate "DB/query slow" from "cold compute" from "Next dev overhead".
async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = process.hrtime.bigint()
  const out = await fn()
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  console.log(`  ${label.padEnd(34)} ${ms.toFixed(0).padStart(6)} ms`)
  return out
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "ritikkushwaha1234@gmail.com" },
  })
  if (!user) throw new Error("no user")
  const uid = user.id

  console.log("── DB state ──")
  const [txCount, accounts, pending] = await Promise.all([
    prisma.transaction.count({ where: { userId: uid } }),
    prisma.account.findMany({
      where: { userId: uid },
      select: { id: true, name: true, accountNumber: true, _count: { select: { transactions: true } } },
    }),
    prisma.statementImport.count({ where: { userId: uid, status: "PENDING" } }),
  ])
  console.log(`  transactions: ${txCount}`)
  console.log(`  pending imports (uncommitted): ${pending}`)
  for (const a of accounts) {
    console.log(`  account ${a.name} [${a.accountNumber}] id=${a.id} → ${a._count.transactions}`)
  }

  console.log("\n── warm-up (first query pays cold-start) ──")
  await time("SELECT 1", () => prisma.$queryRaw`SELECT 1`)

  console.log("\n── base latency (5× simple round-trip) ──")
  for (let i = 0; i < 5; i++) {
    await time(`SELECT 1 #${i + 1}`, () => prisma.$queryRaw`SELECT 1`)
  }

  console.log("\n── /transactions page data calls (sequential, as the page runs them) ──")
  await time("listTransactions (default)", () => listTransactions(uid, {}))
  await time("listTransactionMonths", () => listTransactionMonths(uid))
  await time("getCategoryOptions", () => getCategoryOptions(uid))
  await time("getAccountSummaries", () => getAccountSummaries(uid))
  await time("listTransactions (account filter)", () =>
    listTransactions(uid, { accountId: accounts[0]?.id })
  )
  await time("listTransactions (q='swiggy')", () => listTransactions(uid, { q: "swiggy" }))

  console.log("\n── all-parallel (if the page fetched concurrently) ──")
  await time("Promise.all of the 4 reads", () =>
    Promise.all([
      listTransactions(uid, {}),
      listTransactionMonths(uid),
      getCategoryOptions(uid),
      getAccountSummaries(uid),
    ])
  )

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
