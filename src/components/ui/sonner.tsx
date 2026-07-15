"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

import { themeMode } from "@/design-system/themes"

// The Neon Auth UI provider mounts its OWN bare sonner <Toaster/> (can't be
// disabled via props), and sonner mirrors every toast into ALL mounted toasters
// — so toasts showed twice. Ours carries the `toaster` class; this rule hides
// any *other* (unmarked) sonner toaster so each toast appears once, in ours.
// Inline <style> (not globals.css) because Tailwind v4's Lightning CSS drops a
// rule whose selector appears in no scanned source.
const SUPPRESS_DUPLICATE_TOASTER =
  "ol[data-sonner-toaster]:not(.toaster){display:none !important}"

const Toaster = ({ ...props }: ToasterProps) => {
  // Named palettes (carbon, paper, …) mean nothing to Sonner — collapse the
  // resolved theme to light/dark so its default styling matches ours.
  const { resolvedTheme } = useTheme()

  return (
    <>
      <style href="suppress-duplicate-toaster" precedence="high">
        {SUPPRESS_DUPLICATE_TOASTER}
      </style>
      <Sonner
        theme={themeMode(resolvedTheme)}
        className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
      />
    </>
  )
}

export { Toaster }
