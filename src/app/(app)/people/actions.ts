"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth"
import { toErrorMessage } from "@/lib/errors"
import {
  createPerson,
  deletePerson,
  setPersonTags,
  updatePerson,
} from "@/lib/services/people"
import type { ActionResult } from "@/lib/actions"

const createSchema = z.object({
  name: z.string().min(1, "Name is required.").max(60),
  tags: z.array(z.string()).default([]),
  note: z.string().max(200).optional(),
  /** Set when registering from a suggestion — auto-tags that counterparty's rows. */
  assignCounterparty: z.string().optional(),
})

export async function createPersonAction(
  input: z.input<typeof createSchema>
): Promise<ActionResult<{ id: string; tagged: number }>> {
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
  input: { name?: string; note?: string | null }
): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await updatePerson({ userId: user.id, personId, ...input })
    revalidatePath("/people")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function setPersonTagsAction(
  personId: string,
  tags: string[]
): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await setPersonTags(user.id, personId, tags)
    revalidatePath("/", "layout")
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
