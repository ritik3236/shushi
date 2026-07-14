import { readFileSync } from "node:fs"

import { beforeAll, describe, expect, it } from "vitest"

import { parseStatementFile } from "@/lib/imports/detect"
import {
  isGpayStatement,
  parseGpayStatement,
} from "@/lib/imports/parsers/gpay-statement-pdf"
import { extractPdfText } from "@/lib/imports/pdf"
import type { ParsedStatement } from "@/lib/imports/types"

const fixture = (name: string): Buffer => readFileSync(new URL(`../fixtures/${name}`, import.meta.url))
const FILE = "gpay_statement_20260101_20260630.pdf"

describe("parseGpayStatement", () => {
  let result: ParsedStatement

  beforeAll(async () => {
    result = parseGpayStatement(await extractPdfText(fixture(FILE)))
  })

  it("maps to the Union Bank account only", () => {
    expect(result.kind).toBe("STATEMENT")
    expect(result.fileType).toBe("GPAY_STATEMENT_PDF")
    expect(result.account).toEqual({
      bank: "Union Bank of India",
      accountNumber: "UNIONBANK-0003",
      type: "SAVINGS",
      name: "Union Bank of India Savings",
    })
  })

  it("reads the statement period from the header", () => {
    expect(result.periodStart).toBe("2026-01-01")
    expect(result.periodEnd).toBe("2026-06-30")
  })

  it("keeps only the 113 Union Bank rows (drops Axis/HDFC/UPI-Lite)", () => {
    expect(result.transactions).toHaveLength(113)
    const debits = result.transactions.filter((t) => t.direction === "DEBIT")
    const credits = result.transactions.filter((t) => t.direction === "CREDIT")
    expect(debits).toHaveLength(66)
    expect(credits).toHaveLength(47)
  })

  it("parses a paid row with a clean name and the UPI id as refNo, no balance", () => {
    const row = result.transactions.find((t) => t.refNo === "600250906924")
    expect(row).toEqual({
      date: "2026-01-02",
      narration: "Paid to IMRAN HOSSAIN MOLLA",
      refNo: "600250906924",
      amount: "680.00",
      direction: "DEBIT",
    })
    expect(row?.balanceAfter).toBeUndefined()
  })

  it("classifies self-transfers on both sides (in as credit, out as debit)", () => {
    const transfers = result.transactions.filter((t) => /^Self transfer/.test(t.narration))
    expect(transfers).toHaveLength(9)
    expect(transfers.filter((t) => t.direction === "DEBIT")).toHaveLength(4) // out to Axis/HDFC
    expect(transfers.filter((t) => t.direction === "CREDIT")).toHaveLength(5) // in from Axis/HDFC
  })
})

describe("isGpayStatement", () => {
  it("recognizes a GPay statement and rejects other text", () => {
    expect(isGpayStatement("… payments made by you on the Google Pay app … Transaction statement")).toBe(true)
    expect(isGpayStatement("Tran Date,CHQNO,PARTICULARS")).toBe(false)
  })
})

describe("parseStatementFile dispatch", () => {
  it("routes a GPay PDF to the Union Bank statement parser", async () => {
    const parsed = await parseStatementFile(fixture(FILE))
    expect(parsed.kind).toBe("STATEMENT")
    if (parsed.kind === "STATEMENT") {
      expect(parsed.fileType).toBe("GPAY_STATEMENT_PDF")
      expect(parsed.account.bank).toBe("Union Bank of India")
    }
  })
})
