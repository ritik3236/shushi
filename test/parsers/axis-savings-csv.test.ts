import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { parseAxisSavingsCsv } from "@/lib/imports/parsers/axis-savings-csv"
import { StatementParseError } from "@/lib/imports/types"

const fixture = (name: string): Buffer => readFileSync(new URL(`../fixtures/${name}`, import.meta.url))

describe("parseAxisSavingsCsv", () => {
  describe("918010043605665 (1).csv", () => {
    const result = parseAxisSavingsCsv(fixture("918010043605665 (1).csv"))

    it("parses the account block", () => {
      expect(result.kind).toBe("STATEMENT")
      expect(result.fileType).toBe("AXIS_SAVINGS_CSV")
      expect(result.account).toEqual({
        bank: "Axis Bank",
        accountNumber: "918010043605665",
        type: "SAVINGS",
        name: "Axis Bank Savings",
        ifsc: "UTIB0003870",
        holderName: "RITIK KUSHWAHA",
      })
    })

    it("parses the statement period", () => {
      expect(result.periodStart).toBe("2026-03-31")
      expect(result.periodEnd).toBe("2026-05-01")
    })

    it("parses all 22 transactions, first being the interest credit", () => {
      expect(result.transactions).toHaveLength(22)
      expect(result.transactions[0]).toEqual({
        date: "2026-03-31",
        narration: "SB:918010043605665:Int.Pd:01-01-2026 to 31-03-2026",
        amount: "186.00",
        direction: "CREDIT",
        balanceAfter: "11960.38",
      })
    })

    it("parses a DR row as DEBIT and leaves refNo undefined for CHQNO '-'", () => {
      const debit = result.transactions[1]
      expect(debit.date).toBe("2026-04-03")
      expect(debit.narration).toBe("UPI/P2M/609325042254/JIO /Pay/KOTAK MAHINDRA BANK")
      expect(debit.direction).toBe("DEBIT")
      expect(debit.amount).toBe("706.82")
      expect(debit.balanceAfter).toBe("11253.56")
      expect(debit.refNo).toBeUndefined()
    })
  })

  describe("918010043605665 (3).csv", () => {
    const result = parseAxisSavingsCsv(fixture("918010043605665 (3).csv"))

    it("parses the statement period", () => {
      expect(result.periodStart).toBe("2025-01-01")
      expect(result.periodEnd).toBe("2025-05-01")
    })

    it("parses all 304 transactions", () => {
      expect(result.transactions).toHaveLength(304)
    })

    it("parses the 2025-01-06 IMPS credit", () => {
      const credit = result.transactions.find((t) => t.date === "2025-01-06" && t.direction === "CREDIT")
      expect(credit).toEqual({
        date: "2025-01-06",
        narration: "IMPS/P2A/500612128168/BIZDADDY/KOTAKMAH/SW529298/9199999999999485000",
        amount: "107939.00",
        direction: "CREDIT",
        balanceAfter: "108189.08",
      })
    })

    it("parses the last row and stops before the footer", () => {
      expect(result.transactions.at(-1)).toEqual({
        date: "2025-05-01",
        narration: "UPI/P2M/512185292602/Sanjay Photo State On/UPI/AXIS BANK",
        amount: "10.00",
        direction: "DEBIT",
        balanceAfter: "195.82",
      })
    })
  })

  describe("918010043605665.csv", () => {
    const result = parseAxisSavingsCsv(fixture("918010043605665.csv"))

    it("parses the full-year statement", () => {
      expect(result.periodStart).toBe("2025-04-01")
      expect(result.periodEnd).toBe("2026-03-31")
      expect(result.account.accountNumber).toBe("918010043605665")
      expect(result.transactions).toHaveLength(629)
      expect(result.transactions[0]).toEqual({
        date: "2025-04-01",
        narration: "UPI/P2M/545749141723/Zomato private Limite/UPIInt/AXIS BANK",
        amount: "152.77",
        direction: "DEBIT",
        balanceAfter: "38704.64",
      })
      expect(result.transactions.at(-1)).toEqual({
        date: "2026-03-31",
        narration: "SB:918010043605665:Int.Pd:01-01-2026 to 31-03-2026",
        amount: "186.00",
        direction: "CREDIT",
        balanceAfter: "11960.38",
      })
    })
  })

  it("throws StatementParseError when the transaction header is missing", () => {
    expect(() => parseAxisSavingsCsv(Buffer.from("Name :- SOMEONE\nnot,a,statement\n"))).toThrow(StatementParseError)
  })
})
