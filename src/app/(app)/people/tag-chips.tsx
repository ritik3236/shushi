"use client"

import { useState } from "react"
import { X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Small tag chip editor: type + Enter/comma to add, × to remove. Lowercased. */
export function TagChips({
  value,
  onChange,
  placeholder = "add a tag…",
  className,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
}) {
  const [draft, setDraft] = useState("")

  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase()
    if (tag && !value.includes(tag) && value.length < 12) onChange([...value, tag])
    setDraft("")
  }

  return (
    <div
      className={cn(
        "border-input flex min-h-8 flex-wrap items-center gap-1 rounded-md border px-2 py-1",
        className
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="bg-muted inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
        >
          #{tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            add(draft)
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => draft && add(draft)}
        placeholder={value.length ? "" : placeholder}
        className="h-6 min-w-24 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
      />
    </div>
  )
}
