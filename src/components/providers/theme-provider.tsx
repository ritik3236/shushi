"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

import { DEFAULT_THEME, THEME_IDS, THEME_VALUE_MAP } from "@/design-system/themes"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      // Palettes select on `data-theme`; `value` rewrites the two OS-default
      // keys (light/dark) onto their palette names (daylight/carbon) so
      // enableSystem can follow prefers-color-scheme.
      attribute="data-theme"
      themes={THEME_IDS}
      value={THEME_VALUE_MAP}
      defaultTheme={DEFAULT_THEME}
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
