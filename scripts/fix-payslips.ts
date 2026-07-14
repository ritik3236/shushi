import "dotenv/config"

import { prisma } from "@/lib/prisma"
import {
  deletePayslip,
  linkPayslipToTransaction,
  listLinkableCredits,
} from "@/lib/services/payslips"

// One-off: remove the duplicate Aug'25 payslip (the pre-revision slip that came
// from the mislabeled Sep'25 PDF) and hand-link the net-zero Mar'26 payslip to
// its real ₹1,17,167 BizDaddy credit on 12 Mar. Exercises the same service
// functions the UI actions call. Usage: ... scripts/fix-payslips.ts <email>

async function main() {
  const email = process.argv[2]
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error(`No user ${email}`)

  // 1) Delete the duplicate Aug 2025 slip (net 129972, from Sep'25.pdf).
  const dup = await prisma.payslip.findFirst({
    where: { userId: user.id, periodMonth: new Date("2025-08-01"), netPay: 129972 },
  })
  if (dup) {
    await deletePayslip(user.id, dup.id)
    console.log(`Deleted duplicate Aug'25 payslip (${dup.fileName}, net ₹${dup.netPay})`)
  } else {
    console.log("No duplicate Aug'25 payslip found (already removed).")
  }

  // 2) Link the net-zero Mar'26 payslip to its 12 Mar ₹1,17,167 credit.
  const mar = await prisma.payslip.findFirst({
    where: { userId: user.id, periodMonth: new Date("2026-03-01") },
  })
  if (mar && !mar.matchedTransactionId) {
    const candidates = await listLinkableCredits(user.id, mar.id, "117167")
    const target = candidates.find((c) => c.date === "2026-03-12")
    if (target) {
      await linkPayslipToTransaction(user.id, mar.id, target.id)
      console.log(`Linked Mar'26 payslip → ${target.accountName} ${target.date} ₹${target.amount}`)
    } else {
      console.log("Could not find the 12 Mar ₹1,17,167 credit to link.")
    }
  } else if (mar?.matchedTransactionId) {
    console.log("Mar'26 payslip already matched.")
  }

  const [count, matched] = await Promise.all([
    prisma.payslip.count({ where: { userId: user.id } }),
    prisma.payslip.count({ where: { userId: user.id, matchedTransactionId: { not: null } } }),
  ])
  console.log(`\nPayslips now: ${count} total, ${matched} matched`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
