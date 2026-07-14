import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"

import { parseHdfcSavingsXls } from "@/lib/imports/parsers/hdfc-savings-xls"
import { StatementParseError } from "@/lib/imports/types"

function fixture(name: string): Buffer {
  return readFileSync(new URL(`../fixtures/${name}`, import.meta.url))
}

describe("parseHdfcSavingsXls", () => {
  describe("base fixture (Apr-Jul 2026)", () => {
    const parsed = parseHdfcSavingsXls(fixture("Acct_Statement_XXXXXXXX2791_14072026.xls"))

    it("extracts account metadata from the header block", () => {
      expect(parsed.kind).toBe("STATEMENT")
      expect(parsed.fileType).toBe("HDFC_SAVINGS_XLS")
      expect(parsed.account).toEqual({
        bank: "HDFC Bank",
        accountNumber: "50100708932791",
        type: "SAVINGS",
        name: "HDFC Bank Savings",
        ifsc: "HDFC0005604",
        holderName: "MR RITIK KUSHWAHA",
      })
    })

    it("extracts the statement period", () => {
      expect(parsed.periodStart).toBe("2026-04-01")
      expect(parsed.periodEnd).toBe("2026-07-13")
    })

    it("parses all 101 transactions (70 debits, 31 credits per the statement summary)", () => {
      expect(parsed.transactions).toHaveLength(101)
      const debits = parsed.transactions.filter((t) => t.direction === "DEBIT")
      const credits = parsed.transactions.filter((t) => t.direction === "CREDIT")
      expect(debits).toHaveLength(70)
      expect(credits).toHaveLength(31)
      // Statement summary block: Debits 596015.40, Credits 640832.53.
      const sum = (list: { amount: string }[]) =>
        Math.round(list.reduce((acc, t) => acc + Number(t.amount) * 100, 0))
      expect(sum(debits)).toBe(59601540)
      expect(sum(credits)).toBe(64083253)
    })

    it("parses the first transaction", () => {
      expect(parsed.transactions[0]).toEqual({
        date: "2026-04-01",
        valueDate: "2026-04-01",
        narration: "ACH D- INDIAN CLEARING CORP-0000EYD3KW7L",
        refNo: "0000003285525481",
        amount: "15000.00",
        direction: "DEBIT",
        balanceAfter: "46706.77",
      })
    })

    it("parses the last transaction", () => {
      expect(parsed.transactions[100]).toEqual({
        date: "2026-07-13",
        valueDate: "2026-07-13",
        narration:
          "UPI-INDIAN CLEARING CORP-ZERODHA.ICCL6.BRK@VALIDYES-HDFC0000060-619468893339-MERCHANT UPI TXN",
        refNo: "0000619468893339",
        amount: "1000.00",
        direction: "DEBIT",
        balanceAfter: "106523.90",
      })
    })

    it("parses the 2026-04-07 FT credit from MAMATA SHRIVASTAVA", () => {
      const credit = parsed.transactions.find(
        (t) => t.date === "2026-04-07" && t.direction === "CREDIT",
      )
      expect(credit).toBeDefined()
      expect(credit?.amount).toBe("100000.00")
      expect(credit?.narration).toContain("FT - CR")
      expect(credit?.narration).toContain("MAMATA SHRIVASTAVA")
      expect(credit?.balanceAfter).toBe("140782.77")
    })

    it("keeps the sign on an overdrawn closing balance", () => {
      const overdrawn = parsed.transactions.find((t) => t.refNo === "0000614963638805")
      expect(overdrawn?.date).toBe("2026-05-29")
      expect(overdrawn?.amount).toBe("25000.00")
      expect(overdrawn?.direction).toBe("DEBIT")
      expect(overdrawn?.balanceAfter).toBe("-23912.26")
    })

    it("drops all-zero reference numbers but keeps alphanumeric ones", () => {
      const interest = parsed.transactions.find((t) =>
        t.narration.startsWith("INTEREST DEBITED TILL 30-MAY-2026"),
      )
      expect(interest?.refNo).toBeUndefined()
      expect(interest?.amount).toBe("12.00")
      const imps = parsed.transactions.find((t) =>
        t.narration.includes("EPR2714977186545"),
      )
      expect(imps?.refNo).toBe("EPR2714977186545")
      expect(imps?.amount).toBe("5.90")
    })

    it("keeps a value date that differs from the transaction date", () => {
      const interest = parsed.transactions.find((t) =>
        t.narration.startsWith("INTEREST PAID TILL 30-JUN-2026"),
      )
      expect(interest?.date).toBe("2026-07-01")
      expect(interest?.valueDate).toBe("2026-06-30")
      expect(interest?.direction).toBe("CREDIT")
      expect(interest?.amount).toBe("270.00")
    })

    it("emits well-formed values on every row", () => {
      for (const t of parsed.transactions) {
        expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(t.amount).toMatch(/^\d+\.\d{2}$/)
        expect(["DEBIT", "CREDIT"]).toContain(t.direction)
        expect(t.narration.length).toBeGreaterThan(0)
      }
    })
  })

  describe("variant fixtures (different periods, same account)", () => {
    it("parses the (1) variant — calendar year 2025", () => {
      const parsed = parseHdfcSavingsXls(
        fixture("Acct_Statement_XXXXXXXX2791_14072026 (1).xls"),
      )
      expect(parsed.account.accountNumber).toBe("50100708932791")
      expect(parsed.periodStart).toBe("2025-01-01")
      expect(parsed.periodEnd).toBe("2025-12-31")
      expect(parsed.transactions).toHaveLength(317)
      expect(parsed.transactions[0]?.date).toBe("2025-01-01")
    })

    it("parses the (2) variant — Jan-Apr 2026", () => {
      const parsed = parseHdfcSavingsXls(
        fixture("Acct_Statement_XXXXXXXX2791_14072026 (2).xls"),
      )
      expect(parsed.account.accountNumber).toBe("50100708932791")
      expect(parsed.periodStart).toBe("2026-01-01")
      expect(parsed.periodEnd).toBe("2026-04-01")
      expect(parsed.transactions).toHaveLength(95)
      expect(parsed.transactions[94]?.balanceAfter).toBe("46706.77")
    })
  })

  describe("edge cases (synthetic workbooks)", () => {
    function workbookBuffer(rows: (string | number | null)[][]): Buffer {
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Sheet 1")
      return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
    }

    const headerRows: (string | number | null)[][] = [
      ["MR TEST HOLDER", null, null, null, "Address :HDFC BANK LTD", null, null],
      [null, null, null, null, "Account No :50100708932791   OTHER", null, null],
      ["Statement From  :  01/04/2026         To  :  30/04/2026", null, null, null, "RTGS/NEFT IFSC :HDFC0005604   MICR :491240008", null, null],
      ["********************", null, null, null, null, null, null],
      ["Date", "Narration", "Chq./Ref.No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
      ["********", "****", "****", "****", "****", "****", "****"],
    ]

    it("joins wrapped narration continuation rows and reads Excel-serial dates", () => {
      // 46113 is the Excel serial for 2026-04-01.
      const parsed = parseHdfcSavingsXls(
        workbookBuffer([
          ...headerRows,
          [46113, "UPI-SOMEONE-LONG NARRATION PART ONE", "0000000000000123", 46113, 100, null, 900.5],
          [null, "PART TWO WRAPPED", null, null, null, null, null],
          ["02/04/26", "SALARY CREDIT", "000000000000000", "02/04/26", null, 5000, 5900.5],
          ["********", "****", "****", "****", "****", "****", "****"],
          ["STATEMENT SUMMARY  :-", null, null, null, null, null, null],
        ]),
      )
      expect(parsed.transactions).toHaveLength(2)
      expect(parsed.transactions[0]).toEqual({
        date: "2026-04-01",
        valueDate: "2026-04-01",
        narration: "UPI-SOMEONE-LONG NARRATION PART ONE PART TWO WRAPPED",
        refNo: "0000000000000123",
        amount: "100.00",
        direction: "DEBIT",
        balanceAfter: "900.50",
      })
      expect(parsed.transactions[1]?.refNo).toBeUndefined()
      expect(parsed.transactions[1]?.direction).toBe("CREDIT")
      expect(parsed.account.holderName).toBe("MR TEST HOLDER")
    })

    it("throws StatementParseError when a row carries both amounts", () => {
      expect(() =>
        parseHdfcSavingsXls(
          workbookBuffer([...headerRows, ["01/04/26", "BAD ROW", null, "01/04/26", 100, 200, 900]]),
        ),
      ).toThrow(StatementParseError)
    })

    it("throws StatementParseError on a non-statement file", () => {
      expect(() => parseHdfcSavingsXls(Buffer.from("definitely not a statement"))).toThrow(
        StatementParseError,
      )
    })

    it("throws StatementParseError when the account number is missing", () => {
      expect(() =>
        parseHdfcSavingsXls(
          workbookBuffer([
            ["Date", "Narration", "Chq./Ref.No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
          ]),
        ),
      ).toThrow(StatementParseError)
    })
  })
})
