"use server"

import { revalidatePath } from "next/cache"

import { requireUser } from "@/lib/auth"
import { toErrorMessage } from "@/lib/errors"
import { PasswordRequiredError } from "@/lib/imports/detect"
import {
  commitImport,
  discardImport,
  previewStatementFile,
  type CommitResult,
  type ImportPreview,
} from "@/lib/services/imports"
import type { ActionResult } from "@/lib/actions"

const MAX_FILE_BYTES = 15 * 1024 * 1024

export async function uploadStatementAction(
  formData: FormData
): Promise<ActionResult<ImportPreview>> {
  try {
    const user = await requireUser()
    const file = formData.get("file")
    if (!(file instanceof File)) return { ok: false, error: "Choose a file to import." }
    if (file.size === 0) return { ok: false, error: "That file is empty." }
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, error: "File is larger than 15 MB — that doesn't look like a statement." }
    }
    const password = formData.get("password")
    const buffer = Buffer.from(await file.arrayBuffer())
    const preview = await previewStatementFile({
      userId: user.id,
      fileName: file.name,
      buffer,
      password: typeof password === "string" && password ? password : undefined,
    })
    return { ok: true, data: preview }
  } catch (error) {
    if (error instanceof PasswordRequiredError) {
      return { ok: false, error: error.message, passwordRequired: true }
    }
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function commitImportAction(
  importId: string,
  forceRefNos: string[] = []
): Promise<ActionResult<CommitResult>> {
  try {
    const user = await requireUser()
    const result = await commitImport(user.id, importId, forceRefNos)
    revalidatePath("/", "layout")
    return { ok: true, data: result }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function discardImportAction(importId: string): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await discardImport(user.id, importId)
    revalidatePath("/imports")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}
