import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { parseAxisCcXlsx } from "@/lib/imports/parsers/axis-cc-xlsx"
import { StatementParseError } from "@/lib/imports/types"

const FIXTURES = path.resolve(__dirname, "../fixtures")

function fixture(name: string): Buffer {
  return readFileSync(path.join(FIXTURES, name))
}

describe("parseAxisCcXlsx", () => {
  it("parses the Jul 2026 statement (base file)", () => {
    const result = parseAxisCcXlsx(fixture("CC_Statement_2026_07_14.xlsx"))

    expect(result.kind).toBe("STATEMENT")
    expect(result.fileType).toBe("AXIS_CC_XLSX")
    expect(result.account).toEqual({
      bank: "Axis Bank",
      accountNumber: "AXIS-FLIPKART-CC",
      type: "CREDIT_CARD",
      name: "Axis Flipkart Credit Card",
      creditLimit: "200000.00",
      holderName: "RITIK KUSHWAHA",
    })
    // Negative totalDue/openingBalance = credit balance; sign is kept.
    expect(result.statementMeta).toEqual({
      statementMonth: "2026-07",
      totalDue: "-105659.69",
      minDue: "0.00",
      dueDate: "2026-08-02",
      openingBalance: "-187831.61",
      creditLimit: "200000.00",
    })
    expect(result.transactions).toHaveLength(35)
    expect(result.periodStart).toBe("2026-06-13")
    expect(result.periodEnd).toBe("2026-07-09")
    expect(result.transactions[0]).toEqual({
      date: "2026-07-09",
      narration: "Cashback credit Jun26-POS:223~UBER_PVR_SWIGGY:15",
      amount: "238.00",
      direction: "CREDIT",
    })
    expect(result.transactions[34]).toEqual({
      date: "2026-06-13",
      narration: "PTM*FLIPKART INTERNET,NOIDA",
      amount: "391.00",
      direction: "DEBIT",
    })
  })

  it("parses the Jun 2026 statement — negative dues, real duplicate rows", () => {
    const result = parseAxisCcXlsx(fixture("CC_Statement_2026_07_14 (1).xlsx"))

    expect(result.statementMeta).toEqual({
      statementMonth: "2026-06",
      totalDue: "-187831.61",
      // Printed as "₹ -0.00"; negative zero is normalized.
      minDue: "0.00",
      dueDate: "2026-07-03",
      openingBalance: "74158.54",
      creditLimit: "200000.00",
    })
    expect(result.transactions).toHaveLength(44)
    expect(result.periodStart).toBe("2026-05-15")
    expect(result.periodEnd).toBe("2026-06-12")

    expect(result.transactions).toContainEqual({
      date: "2026-06-12",
      narration: "BUNDL TECHNOLOGIES,BENGALURU",
      amount: "639.00",
      direction: "DEBIT",
    })
    expect(result.transactions).toContainEqual({
      date: "2026-06-04",
      narration: "ANTHROPIC* CLAUDE SUB,SAN FRANCISCO",
      amount: "9337.16",
      direction: "DEBIT",
    })

    // Duplicate rows within one file are real transactions — both kept.
    const narayanaCredits = result.transactions.filter(
      (tx) =>
        tx.date === "2026-06-12" &&
        tx.narration === "Narayana Hrudayalaya L,Bengaluru" &&
        tx.amount === "100000.00" &&
        tx.direction === "CREDIT",
    )
    expect(narayanaCredits).toHaveLength(2)
  })

  it("parses the May 2026 statement — positive dues", () => {
    const result = parseAxisCcXlsx(fixture("CC_Statement_2026_07_14 (2).xlsx"))

    expect(result.statementMeta).toEqual({
      statementMonth: "2026-05",
      totalDue: "74158.54",
      minDue: "1484.00",
      dueDate: "2026-06-02",
      openingBalance: "76719.83",
      creditLimit: "200000.00",
    })
    expect(result.transactions).toHaveLength(65)
    expect(result.periodStart).toBe("2026-04-15")
    expect(result.periodEnd).toBe("2026-05-11")
    expect(result.transactions[64]).toEqual({
      date: "2026-04-15",
      narration: "BBPS Payment Received - HD016105BALAAAEA8VUK",
      amount: "76719.83",
      direction: "CREDIT",
    })
  })

  it("parses the Jan 2026 statement — cycle spans the year boundary", () => {
    const result = parseAxisCcXlsx(fixture("CC_Statement_2026_07_14 (8).xlsx"))

    expect(result.statementMeta).toEqual({
      statementMonth: "2026-01",
      totalDue: "72223.05",
      minDue: "2728.00",
      dueDate: "2026-02-02",
      openingBalance: "113061.12",
      creditLimit: "200000.00",
    })
    expect(result.transactions).toHaveLength(33)
    expect(result.periodStart).toBe("2025-12-14")
    expect(result.periodEnd).toBe("2026-01-13")
    // Narration whitespace is collapsed ("AMAZON  DEBIT" → "AMAZON DEBIT").
    expect(result.transactions[32]).toEqual({
      date: "2025-12-14",
      narration: "AMAZON DEBIT CARD WAL,www.amazon.in",
      amount: "230.09",
      direction: "DEBIT",
    })
  })

  it("throws StatementParseError on a file of the wrong shape", () => {
    expect(() => parseAxisCcXlsx(fixture("918010043605665.csv"))).toThrow(StatementParseError)
    expect(() => parseAxisCcXlsx(Buffer.from("not a spreadsheet"))).toThrow(StatementParseError)
  })
})
