"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth"
import { toErrorMessage } from "@/lib/errors"
import { assignTransactionToPerson, createPerson } from "@/lib/services/people"
import {
  createRuleFromTransaction,
  setTransactionCategory,
  setTransactionExcluded,
  setTransactionTags,
} from "@/lib/services/transactions"
import { unlinkTransfer } from "@/lib/transfers/detect"
import type { ActionResult } from "@/lib/actions"

const assignPersonSchema = z.object({
  transactionId: z.string().min(1),
  /** Assign to this person, or null to clear. Ignored when newName is set. */
  personId: z.string().nullable().optional(),
  /** Create a new person with this name and assign the transaction to them. */
  newName: z.string().trim().min(1).max(60).optional(),
})

/** Assign a transaction to a person — existing, newly-created, or none. */
export async function assignPersonAction(
  input: z.input<typeof assignPersonSchema>
): Promise<ActionResult<{ personId: string | null }>> {
  try {
    const user = await requireUser()
    const { transactionId, personId, newName } = assignPersonSchema.parse(input)
    let target = personId ?? null
    if (newName) {
      const { id } = await createPerson({ userId: user.id, name: newName })
      target = id
    }
    await assignTransactionToPerson(user.id, transactionId, target)
    revalidatePath("/", "layout")
    return { ok: true, data: { personId: target } }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function setCategoryAction(
  transactionId: string,
  categoryId: string | null
): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await setTransactionCategory(user.id, transactionId, categoryId)
    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function setExcludedAction(
  transactionId: string,
  excludeFromSpend: boolean
): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await setTransactionExcluded(user.id, transactionId, excludeFromSpend)
    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function setTagsAction(
  transactionId: string,
  tags: string[]
): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await setTransactionTags(user.id, transactionId, tags)
    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

const createRuleSchema = z.object({
  pattern: z.string().min(3, "Pattern must be at least 3 characters."),
  field: z.enum(["NARRATION", "COUNTERPARTY"]),
  categoryId: z.string().min(1),
  applyToExisting: z.boolean(),
})

export async function createRuleAction(
  input: z.input<typeof createRuleSchema>
): Promise<ActionResult<{ applied: number }>> {
  try {
    const user = await requireUser()
    const parsed = createRuleSchema.parse(input)
    const result = await createRuleFromTransaction({ userId: user.id, ...parsed })
    revalidatePath("/", "layout")
    return { ok: true, data: result }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function unlinkTransferAction(transferGroupId: string): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await unlinkTransfer(user.id, transferGroupId)
    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}
