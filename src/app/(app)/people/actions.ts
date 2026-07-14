"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth"
import { toErrorMessage } from "@/lib/errors"
import { createPerson, deletePerson, updatePerson } from "@/lib/services/people"
import type { ActionResult } from "@/lib/actions"

/** Signed money string, e.g. "5000", "-26190.50". Blank is allowed (→ 0). */
const moneyString = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,2})?$/, "Enter a valid amount, e.g. 5000 or -26190.")

const createSchema = z.object({
  name: z.string().min(1, "Name is required.").max(60),
  note: z.string().max(200).optional(),
  openingBalance: moneyString.optional(),
  /** Set when registering from a suggestion — assigns that counterparty's rows. */
  assignCounterparty: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1, "Name is required.").max(60).optional(),
  note: z.string().max(200).nullable().optional(),
  openingBalance: moneyString.optional(),
})

export async function createPersonAction(
  input: z.input<typeof createSchema>
): Promise<ActionResult<{ id: string; assigned: number }>> {
  try {
    const user = await requireUser()
    const parsed = createSchema.parse(input)
    const result = await createPerson({ userId: user.id, ...parsed })
    revalidatePath("/", "layout")
    return { ok: true, data: result }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function updatePersonAction(
  personId: string,
  input: z.input<typeof updateSchema>
): Promise<ActionResult> {
  try {
    const user = await requireUser()
    const parsed = updateSchema.parse(input)
    await updatePerson({ userId: user.id, personId, ...parsed })
    revalidatePath("/people")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function deletePersonAction(personId: string): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await deletePerson(user.id, personId)
    revalidatePath("/people")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}
