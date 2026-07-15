import "server-only"

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { NotFoundError, ValidationError } from "@/lib/errors"

const CHART_COLOR = /^chart-[1-8]$/
const MONEY = /^-?\d+(\.\d{1,2})?$/

/**
 * Edit an account's user-owned fields. Statement-derived fields (bank, number,
 * type) are never editable here — only the manual overlays: display name, colour
 * accent, credit limit (e.g. after a limit hike), and the opening balance that
 * lets a balance-less account track a running balance.
 */
export async function updateAccount(input: {
  userId: string
  accountId: string
  name?: string
  color?: string | null
  creditLimit?: string | null
  openingBalance?: string
}): Promise<void> {
  const account = await prisma.account.findFirst({
    where: { id: input.accountId, userId: input.userId },
    select: { id: true },
  })
  if (!account) throw new NotFoundError("Account not found.")

  const data: Prisma.AccountUpdateInput = {}
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) throw new ValidationError("Account name is required.")
    data.name = name
  }
  if (input.color !== undefined) {
    if (input.color !== null && !CHART_COLOR.test(input.color)) {
      throw new ValidationError("Invalid colour.")
    }
    data.color = input.color
  }
  if (input.creditLimit !== undefined) {
    const v = input.creditLimit?.trim() ?? ""
    if (v === "") {
      data.creditLimit = null
    } else if (!MONEY.test(v) || Number(v) < 0) {
      throw new ValidationError("Enter a valid credit limit.")
    } else {
      data.creditLimit = v
    }
  }
  if (input.openingBalance !== undefined) {
    const v = input.openingBalance.trim()
    if (v === "") {
      data.openingBalance = "0"
    } else if (!MONEY.test(v)) {
      throw new ValidationError("Opening balance must be a number.")
    } else {
      data.openingBalance = v
    }
  }
  await prisma.account.update({ where: { id: account.id }, data })
}
