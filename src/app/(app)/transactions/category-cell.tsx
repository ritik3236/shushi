"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { CategorySelect } from "@/components/finance/category-select"
import type { CategoryOption } from "@/lib/services/categories"

import { setCategoryAction } from "./actions"

/** Inline category picker with optimistic UI: show the pick immediately, revert on error. */
export function CategoryCell({
  transactionId,
  categoryId,
  options,
}: {
  transactionId: string
  categoryId: string | null
  options: CategoryOption[]
}) {
  const router = useRouter()
  const [value, setValue] = useState(categoryId)
  const [synced, setSynced] = useState(categoryId)
  const [pending, startTransition] = useTransition()

  // Adopt fresh server data (e.g. a rule categorized this row) between renders.
  if (categoryId !== synced) {
    setSynced(categoryId)
    setValue(categoryId)
  }

  function handleChange(next: string | null) {
    if (next === value) return
    const previous = value
    setValue(next)
    startTransition(async () => {
      const result = await setCategoryAction(transactionId, next)
      if (result.ok) {
        router.refresh()
      } else {
        setValue(previous)
        toast.error(result.error)
      }
    })
  }

  return (
    <CategorySelect
      variant="ghost"
      options={options}
      value={value}
      onChange={handleChange}
      disabled={pending}
    />
  )
}
