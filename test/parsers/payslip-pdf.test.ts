import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { parsePayslipPdf } from "@/lib/imports/parsers/payslip-pdf"
import { StatementParseError } from "@/lib/imports/types"

const fixturesDir = fileURLToPath(new URL("../fixtures/payslips", import.meta.url))

async function parseFixture(name: string) {
  return parsePayslipPdf(await readFile(path.join(fixturesDir, name)))
}

function toPaise(money: string): number {
  return Math.round(Number(money) * 100)
}

describe("parsePayslipPdf — salary payslips", () => {
  it("parses the Mar'26 payslip (two-column table with LOP + Advance Salary)", async () => {
    const slip = await parseFixture("Payslip_Ritik Kushwaha - Mar'26.pdf")

    expect(slip.kind).toBe("PAYSLIP")
    expect(slip.fileType).toBe("PAYSLIP_PDF")
    expect(slip.payslipKind).toBe("SALARY")
    expect(slip.employer).toBe("BizDaddy")
    expect(slip.periodMonth).toBe("2026-03-01")
    expect(slip.grossEarnings).toBe("117167.00")
    expect(slip.totalDeductions).toBe("117167.00")
    expect(slip.netPay).toBe("0.00")
    expect(slip.bankAccountNumber).toBe("918010043605665")

    expect(slip.earnings).toEqual([
      { label: "Basic", amount: "58333.00" },
      { label: "HRA", amount: "29167.00" },
      { label: "Medical Allowance", amount: "17500.00" },
      { label: "Other Allowance", amount: "11667.00" },
      { label: "Internet Reimbursement", amount: "500.00" },
    ])
    expect(slip.deductions).toEqual([
      { label: "LOP", amount: "16936.00" },
      { label: "Advance Salary", amount: "100231.00" },
    ])

    expect(slip.meta).toMatchObject({
      department: "Technology",
      designation: "Web Developer II",
      lossOfPayDays: "4.5",
      daysPayable: "26.5",
    })
  })

  it("parses the Aug'25 (Revised) payslip (one deduction, extra reimbursement line)", async () => {
    const slip = await parseFixture("Payslip_Ritik Kushwaha - Aug'25 (Revised).pdf")

    expect(slip.periodMonth).toBe("2025-08-01")
    expect(slip.grossEarnings).toBe("129533.00")
    expect(slip.totalDeductions).toBe("3763.00")
    expect(slip.netPay).toBe("125770.00")
    expect(slip.deductions).toEqual([{ label: "LOP", amount: "3763.00" }])
    expect(slip.earnings).toContainEqual({
      label: "Business Platform Subscription Reimbursement",
      amount: "12366.00",
    })
  })

  it("parses the Dec'25 payslip (no deductions, incentive month)", async () => {
    const slip = await parseFixture("Payslip_Ritik Kushwaha - Dec'25.pdf")

    expect(slip.periodMonth).toBe("2025-12-01")
    expect(slip.grossEarnings).toBe("232033.00")
    expect(slip.totalDeductions).toBe("0.00")
    expect(slip.netPay).toBe("232033.00")
    expect(slip.deductions).toEqual([])
    expect(slip.earnings).toHaveLength(7)
    expect(slip.earnings).toContainEqual({ label: "Project Based Incentive", amount: "100000.00" })
  })
})

describe("parsePayslipPdf — contractor fee statements", () => {
  it("parses the corrected statement (incentive + two deductions)", async () => {
    const slip = await parseFixture("Corrected_Contractor Fee Statement - Ritik.pdf")

    expect(slip.kind).toBe("PAYSLIP")
    expect(slip.fileType).toBe("CONTRACTOR_FEE_PDF")
    expect(slip.payslipKind).toBe("CONTRACTOR_FEE")
    expect(slip.employer).toBe("BizDaddy")
    expect(slip.periodMonth).toBe("2026-04-01")
    expect(slip.grossEarnings).toBe("217167.00")
    expect(slip.totalDeductions).toBe("24174.00")
    expect(slip.netPay).toBe("192993.00")

    expect(slip.earnings).toEqual([
      { label: "Monthly Professional Retainer Fee", amount: "117167.00" },
      { label: "Performance Incentive (if applicable)", amount: "100000.00" },
    ])
    expect(slip.deductions).toEqual([
      { label: "Advance", amount: "16396.00" },
      { label: "Non-Billable Days", amount: "7778.00" },
    ])

    // gross − deductions must equal net
    expect(toPaise(slip.grossEarnings) - toPaise(slip.totalDeductions)).toBe(toPaise(slip.netPay))

    expect(slip.meta).toMatchObject({
      contractorId: "CONTRACT/002",
      billableServiceDays: "28",
      nonBillableDays: "2",
    })
  })

  it("parses the June statement (retainer only, zero-amount rows skipped)", async () => {
    const slip = await parseFixture("Contractor Fee Statement - Ritik.pdf")

    expect(slip.periodMonth).toBe("2026-06-01")
    expect(slip.grossEarnings).toBe("176750.00")
    expect(slip.totalDeductions).toBe("0.00")
    expect(slip.netPay).toBe("176750.00")
    expect(slip.earnings).toEqual([
      { label: "Monthly Professional Retainer Fee", amount: "176750.00" },
    ])
    expect(slip.deductions).toEqual([])
    expect(slip.meta).toMatchObject({ billableServiceDays: "30", nonBillableDays: "0" })
  })
})

describe("parsePayslipPdf — whole fixture set", () => {
  it("parses every fixture PDF with consistent money and dates", async () => {
    const files = (await readdir(fixturesDir)).filter((name) => name.endsWith(".pdf")).sort()
    // 12 FY2025-26 salary months + 2 contractor-fee statements.
    expect(files).toHaveLength(14)

    for (const name of files) {
      const slip = await parseFixture(name)
      expect(slip.kind).toBe("PAYSLIP")
      expect(slip.employer).toBe("BizDaddy")
      expect(slip.periodMonth).toMatch(/^\d{4}-\d{2}-01$/)
      for (const money of [slip.grossEarnings, slip.totalDeductions, slip.netPay]) {
        expect(money).toMatch(/^\d+\.\d{2}$/)
      }
      expect(Number(slip.grossEarnings)).toBeGreaterThan(0)
      expect(slip.earnings.length).toBeGreaterThan(0)
      // every fixture satisfies gross − deductions == net
      expect(toPaise(slip.grossEarnings) - toPaise(slip.totalDeductions)).toBe(toPaise(slip.netPay))
    }
  })
})

describe("parsePayslipPdf — rejection", () => {
  it("throws StatementParseError for a non-PDF buffer", async () => {
    await expect(parsePayslipPdf(Buffer.from("definitely not a pdf"))).rejects.toBeInstanceOf(
      StatementParseError,
    )
  })
})
