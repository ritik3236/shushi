import { cn } from "@/lib/utils"

// The Shushi mark: a maki roll seen top-down — nori ring, rice, salmon centre,
// a rice grain at the core — which also reads as a coin. Concentric (never a
// cross), fixed brand colours so it looks the same in every surface and theme;
// size via className (default set by the caller).
//
// `animated` draws the nori ring in and pops the filling — used on the sign-in
// / welcome screen. Collapses to the final frame under prefers-reduced-motion
// (see the keyframes in globals.css).
export function ShushiLogo({
  className,
  animated = false,
  rounded = "lg",
}: {
  className?: string
  animated?: boolean
  rounded?: "md" | "lg" | "full"
}) {
  const radiusClass =
    rounded === "full" ? "rounded-full" : rounded === "md" ? "rounded-md" : "rounded-[22%]"
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        radiusClass,
        animated && "shushi-logo-animated",
        className
      )}
    >
      <svg viewBox="0 0 32 32" className="size-full" aria-hidden fill="none">
        <rect width="32" height="32" fill="#0F766E" />
        <circle cx="16" cy="16" r="10" fill="#F6EFE0" className="shushi-rice" />
        <circle
          cx="16"
          cy="16"
          r="10"
          fill="none"
          stroke="#0B3F3A"
          strokeWidth="2.6"
          className="shushi-nori"
          pathLength={1}
        />
        <circle cx="16" cy="16" r="5" fill="#FB7185" className="shushi-fill" />
        <circle cx="16" cy="16" r="1.7" fill="#FFF7EC" className="shushi-grain" />
      </svg>
    </span>
  )
}
