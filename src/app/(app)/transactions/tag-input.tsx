"use client"

import { useMemo, useRef, useState } from "react"
import { X } from "lucide-react"

const MAX_TAGS = 8

/**
 * Chip input for editing a transaction's tags: type + Enter to add, click × or
 * Backspace to remove, click a suggestion to add. Tags are normalized lowercase.
 */
export function TagInput({
  value,
  onChange,
  suggestions,
  id,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  /** Tag names the user has used elsewhere, for autocomplete. */
  suggestions: string[]
  id?: string
}) {
  const [draft, setDraft] = useState("")
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const norm = draft.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      suggestions
        .filter((s) => !value.includes(s) && (norm === "" || s.includes(norm)))
        .slice(0, 8),
    [suggestions, value, norm]
  )

  const atMax = value.length >= MAX_TAGS

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase()
    setDraft("")
    if (!tag || value.includes(tag) || value.length >= MAX_TAGS) return
    onChange([...value, tag])
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
    inputRef.current?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      if (norm) addTag(draft)
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  const showSuggestions = focused && filtered.length > 0

  return (
    <div className="relative">
      <div
        className="border-input focus-within:border-ring focus-within:ring-ring/50 flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md border bg-transparent px-1.5 py-1 text-sm focus-within:ring-3"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="bg-muted text-foreground inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs"
          >
            #{tag}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                removeTag(tag)
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={atMax}
          placeholder={atMax ? "Max 8 tags" : value.length ? "" : "Add tag…"}
          className="placeholder:text-muted-foreground min-w-16 flex-1 bg-transparent outline-none disabled:cursor-not-allowed"
        />
      </div>
      {showSuggestions ? (
        <div className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-md border p-1 shadow-md">
          {filtered.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              // Prevent the input from blurring before the click lands.
              onMouseDown={(event) => {
                event.preventDefault()
                addTag(suggestion)
              }}
              className="hover:bg-muted flex w-full items-center gap-0.5 rounded-sm px-2 py-1 text-left text-xs"
            >
              <span className="text-muted-foreground">#</span>
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
