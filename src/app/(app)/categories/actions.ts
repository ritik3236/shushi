"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth"
import { toErrorMessage } from "@/lib/errors"
import {
  createCategory,
  deleteCategory,
  deleteRule,
  renameCategory,
} from "@/lib/services/categories"
import { createRuleFromTransaction } from "@/lib/services/transactions"
import type { ActionResult } from "@/lib/actions"

const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required.").max(40),
  kind: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  parentId: z.string().nullish(),
  icon: z.string().optional(),
  color: z.string().regex(/^chart-[1-8]$/).optional(),
})

export async function createCategoryAction(
  input: z.input<typeof createCategorySchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser()
    const parsed = createCategorySchema.parse(input)
    const result = await createCategory({ userId: user.id, ...parsed })
    revalidatePath("/categories")
    return { ok: true, data: result }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function renameCategoryAction(
  categoryId: string,
  name: string
): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await renameCategory({ userId: user.id, categoryId, name })
    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await deleteCategory(user.id, categoryId)
    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function deleteRuleAction(ruleId: string): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await deleteRule(user.id, ruleId)
    revalidatePath("/categories")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

const createRuleSchema = z.object({
  pattern: z.string().min(3, "Pattern must be at least 3 characters.").max(80),
  field: z.enum(["NARRATION", "COUNTERPARTY"]),
  categoryId: z.string().min(1, "Pick a category."),
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
