import { describe, expect, it } from "vitest"

import { correctedPeriodMonth } from "@/lib/imports/payslip-corrections"

describe("correctedPeriodMonth", () => {
  it("reassigns the Sep'25 slip whose header typo reads August", () => {
    // BizDaddy's September 2025 slip prints "August 2025"; gross 1,29,972.
    expect(
      correctedPeriodMonth({
        employer: "BizDaddy",
        periodMonth: "2025-08-01",
        grossEarnings: "129972.00",
      })
    ).toBe("2025-09-01")
  })

  it("leaves the genuine Aug'25 (Revised) slip untouched — different gross", () => {
    expect(
      correctedPeriodMonth({
        employer: "BizDaddy",
        periodMonth: "2025-08-01",
        grossEarnings: "129533.00",
      })
    ).toBe("2025-08-01")
  })

  it("passes every other slip through unchanged", () => {
    for (const [month, gross] of [
      ["2025-04-01", "100500.00"],
      ["2025-07-01", "117167.00"],
      ["2026-03-01", "117167.00"],
    ] as const) {
      expect(
        correctedPeriodMonth({ employer: "BizDaddy", periodMonth: month, grossEarnings: gross })
      ).toBe(month)
    }
  })
})
