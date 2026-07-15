"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth"
import { toErrorMessage } from "@/lib/errors"
import { updateAccount } from "@/lib/services/accounts"
import type { ActionResult } from "@/lib/actions"

const money = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,2})?$/, "Enter a valid amount.")

const updateSchema = z.object({
  name: z.string().min(1, "Account name is required.").max(60).optional(),
  color: z.string().regex(/^chart-[1-8]$/).nullable().optional(),
  creditLimit: money.nullable().optional(),
  openingBalance: money.optional(),
})

export async function updateAccountAction(
  accountId: string,
  input: z.input<typeof updateSchema>
): Promise<ActionResult> {
  try {
    const user = await requireUser()
    const parsed = updateSchema.parse(input)
    await updateAccount({ userId: user.id, accountId, ...parsed })
    // Balances/labels feed the dashboard + filters too.
    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}
