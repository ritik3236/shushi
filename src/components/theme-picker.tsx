"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Check, Monitor, Palette } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { THEME_GROUPS, THEMES } from "@/design-system/themes"
import { cn } from "@/lib/utils"

const noop = () => () => {}
/** false on the server + first paint, true after hydration — no setState-in-effect. */
function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false
  )
}

/**
 * Grouped-swatch theme picker (Light / Dark / Mix + System). Each swatch sets
 * `data-theme` on itself, so `bg-background` / `bg-primary` inside it resolve to
 * that palette's tokens — the preview is always exactly the real theme.
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  // next-themes has no value until mounted; gate active state to avoid a
  // hydration mismatch (server can't know the stored theme).
  const mounted = useMounted()

  const isActive = (id: string) => mounted && theme === id

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Theme">
          <Palette />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <button
          type="button"
          onClick={() => setTheme("system")}
          aria-pressed={isActive("system")}
          className={cn(
            "hover:bg-muted focus-visible:ring-ring/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2",
            isActive("system") && "bg-muted font-medium"
          )}
        >
          <Monitor className="size-4 opacity-70" />
          System
          {isActive("system") ? <Check className="ml-auto size-4" /> : null}
        </button>

        {THEME_GROUPS.map((g) => (
          <div key={g.group} className="mt-2">
            <p className="text-muted-foreground mb-1.5 px-1 text-[11px] font-medium tracking-wide uppercase">
              {g.label}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {THEMES.filter((t) => t.group === g.group).map((t) => {
                const active = isActive(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    aria-label={t.label}
                    aria-pressed={active}
                    className="group/sw focus-visible:ring-ring/50 flex flex-col items-center gap-1 rounded-md p-1 outline-none focus-visible:ring-2"
                  >
                    <span
                      data-theme={t.value}
                      className={cn(
                        "border-border bg-background ring-offset-background relative flex h-9 w-full items-center justify-center gap-1 rounded-md border transition-all",
                        active
                          ? "ring-primary ring-2 ring-offset-1"
                          : "group-hover/sw:border-foreground/30"
                      )}
                    >
                      <span className="bg-primary size-3 rounded-full" />
                      <span className="border-border bg-card size-3 rounded-full border" />
                      {active ? (
                        <Check className="text-primary absolute inset-0 m-auto size-4" />
                      ) : null}
                    </span>
                    <span className={cn("text-[11px]", active ? "font-medium" : "text-muted-foreground")}>
                      {t.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
