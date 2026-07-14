"use client"

import { useEffect, useRef } from "react"
import type { LucideIcon } from "lucide-react"

type AnimatedNavIconProps = {
  icon: LucideIcon
  active: boolean
  className?: string
}

const TRACE_SHAPES = "path, line, circle, rect, polyline, polygon, ellipse"

// Nav icon that re-traces its stroke when the tab becomes active. Every sub-path
// is normalised to pathLength=1 so they all draw at the same rate (a fixed
// dasharray makes short and long paths finish at different times, which reads as
// janky). Driven by the Web Animations API for a smooth eased curve.
export function AnimatedNavIcon({ icon: Icon, active, className }: AnimatedNavIconProps) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = ref.current
    if (!svg) return

    const shapes = Array.from(svg.querySelectorAll<SVGGeometryElement>(TRACE_SHAPES))

    if (!active) {
      shapes.forEach((el) => {
        el.style.strokeDasharray = ""
        el.style.strokeDashoffset = ""
      })
      return
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const animations = shapes.map((el) => {
      el.setAttribute("pathLength", "1")
      el.style.strokeDasharray = "1"
      return el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration: 900,
        easing: "cubic-bezier(0.65, 0, 0.35, 1)",
        fill: "forwards",
      })
    })

    return () => animations.forEach((a) => a.cancel())
  }, [active])

  return <Icon ref={ref} className={className} />
}
