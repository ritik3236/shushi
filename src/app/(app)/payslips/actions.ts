"use server"

import { revalidatePath } from "next/cache"

import { requireUser } from "@/lib/auth"
import { toErrorMessage } from "@/lib/errors"
import {
  deletePayslip,
  linkPayslipToTransaction,
  listLinkableCredits,
  unlinkPayslipMatch,
  type LinkableCredit,
} from "@/lib/services/payslips"
import type { ActionResult } from "@/lib/actions"

export async function listLinkableCreditsAction(
  payslipId: string,
  search?: string
): Promise<ActionResult<LinkableCredit[]>> {
  try {
    const user = await requireUser()
    const credits = await listLinkableCredits(user.id, payslipId, search)
    return { ok: true, data: credits }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function linkPayslipAction(
  payslipId: string,
  transactionId: string
): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await linkPayslipToTransaction(user.id, payslipId, transactionId)
    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function unlinkPayslipAction(payslipId: string): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await unlinkPayslipMatch(user.id, payslipId)
    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

export async function deletePayslipAction(payslipId: string): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await deletePayslip(user.id, payslipId)
    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}
