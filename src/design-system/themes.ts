// Multi-theme registry. Mirrors the Orbis pattern: named full palettes grouped
// light / dark / mix, a grouped-swatch picker, and one source of truth that both
// the next-themes provider and Sonner read.
//
// next-themes keys vs. data-theme values: the two OS-default palettes use the
// keys "light" and "dark" so `enableSystem` can map prefers-color-scheme onto
// them; `THEME_VALUE_MAP` then rewrites those keys to the real palette names
// ("daylight" / "carbon") on the `data-theme` attribute the CSS selects on.

export type ThemeGroup = "light" | "dark" | "mix"

export type ThemeDef = {
  /** next-themes key (drives storage + OS resolution). */
  id: string
  /** `data-theme` attribute value the CSS palette blocks select on. */
  value: string
  label: string
  group: ThemeGroup
}

export const THEMES: ThemeDef[] = [
  { id: "light", value: "daylight", label: "Daylight", group: "light" },
  { id: "paper", value: "paper", label: "Paper", group: "light" },
  { id: "mist", value: "mist", label: "Mist", group: "light" },
  { id: "dark", value: "carbon", label: "Carbon", group: "dark" },
  { id: "midnight", value: "midnight", label: "Midnight", group: "dark" },
  { id: "abyss", value: "abyss", label: "Abyss", group: "dark" },
  { id: "dim", value: "dim", label: "Dim", group: "mix" },
  { id: "dusk", value: "dusk", label: "Dusk", group: "mix" },
]

export const THEME_IDS = THEMES.map((t) => t.id)

/** next-themes `value` prop: theme key → `data-theme` attribute value. */
export const THEME_VALUE_MAP: Record<string, string> = Object.fromEntries(
  THEMES.map((t) => [t.id, t.value])
)

/** Ordered groups for the picker. */
export const THEME_GROUPS: { group: ThemeGroup; label: string }[] = [
  { group: "light", label: "Light" },
  { group: "dark", label: "Dark" },
  { group: "mix", label: "Mix" },
]

/** System-aware default: the provider follows the OS (daylight ↔ carbon). */
export const DEFAULT_THEME = "system"

/** Coarse light/dark for consumers that only understand two modes (e.g. Sonner). */
export function themeMode(id: string | undefined): "light" | "dark" {
  const def = THEMES.find((t) => t.id === id)
  return def?.group === "light" ? "light" : "dark"
}
