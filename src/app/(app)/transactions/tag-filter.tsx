"use client"

import { useState } from "react"
import { ChevronsUpDown, CircleSlash, Hash } from "lucide-react"

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
import { cn } from "@/lib/utils"

/** Single-select combobox over the user's tags (with usage counts) for filtering. */
export function TagFilter({
  tags,
  value,
  onChange,
  className,
}: {
  tags: { tag: string; count: number }[]
  value: string | null
  onChange: (tag: string | null) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 w-full justify-between gap-1 px-2 text-xs font-normal", className)}
        >
          {value ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Hash className="size-3 shrink-0 opacity-60" />
              <span className="truncate">{value}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">All tags</span>
          )}
          <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search tags…" />
          <CommandList>
            <CommandEmpty>No tags yet.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all"
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                <CircleSlash className="text-muted-foreground size-3.5" />
                All tags
              </CommandItem>
              {tags.map(({ tag, count }) => (
                <CommandItem
                  key={tag}
                  value={tag}
                  onSelect={() => {
                    onChange(tag === value ? null : tag)
                    setOpen(false)
                  }}
                >
                  <Hash className="text-muted-foreground size-3.5" />
                  <span className="truncate">{tag}</span>
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                    {count}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
