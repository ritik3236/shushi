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
}: {
  options: CategoryOption[]
  value: string | null
  onChange: (categoryId: string | null) => void
  placeholder?: string
  allowClear?: boolean
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{
                  background: selected.color ? `var(--${selected.color})` : "var(--muted-foreground)",
                }}
              />
              <span className="truncate">{selected.label}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
        </Button>
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
