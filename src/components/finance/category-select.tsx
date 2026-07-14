"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, CircleSlash } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { CategoryOption } from "@/lib/services/categories"
import { cn } from "@/lib/utils"

/** Searchable category picker (combobox) used everywhere a category is chosen. */
export function CategorySelect({
  options,
  value,
  onChange,
  placeholder = "Set category",
  allowClear = true,
  className,
  disabled,
  variant = "outline",
}: {
  options: CategoryOption[]
  value: string | null
  onChange: (categoryId: string | null) => void
  placeholder?: string
  allowClear?: boolean
  className?: string
  disabled?: boolean
  /** "ghost" = a quiet dot + leaf label with no border, for dense list rows. */
  variant?: "outline" | "ghost"
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.id === value)
  const dotColor = selected?.color ? `var(--${selected.color})` : "var(--muted-foreground)"
  // In a dense row the parent group colour is carried by the dot, so only the
  // leaf name is shown ("Food & Dining › Delivery" → "Delivery").
  const leaf = selected ? (selected.label.split("›").pop() ?? selected.label).trim() : ""

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "ghost" ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={selected ? `Category: ${selected.label}` : "Set category"}
            disabled={disabled}
            className={cn(
              "hover:bg-muted focus-visible:ring-ring/50 inline-flex h-6 max-w-[9rem] items-center gap-1.5 rounded px-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
              className
            )}
          >
            {selected ? (
              <>
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: dotColor }} />
                <span className="truncate">{leaf}</span>
              </>
            ) : (
              <span className="text-muted-foreground/70 inline-flex min-w-0 items-center gap-1.5">
                <span aria-hidden className="size-2 shrink-0 rounded-full border border-dashed border-current" />
                <span className="truncate">Uncategorized</span>
              </span>
            )}
          </button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("h-7 justify-between gap-1 px-2 text-xs font-normal", className)}
          >
            {selected ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: dotColor }} />
                <span className="truncate">{selected.label}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search categories…" />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup>
              {allowClear ? (
                <CommandItem
                  value="uncategorized"
                  onSelect={() => {
                    onChange(null)
                    setOpen(false)
                  }}
                >
                  <CircleSlash className="text-muted-foreground size-3.5" />
                  Uncategorized
                  <Check className={cn("ml-auto size-3.5", value === null ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ) : null}
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      background: option.color ? `var(--${option.color})` : "var(--muted-foreground)",
                    }}
                  />
                  {option.label}
                  <Check
                    className={cn("ml-auto size-3.5", value === option.id ? "opacity-100" : "opacity-0")}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
