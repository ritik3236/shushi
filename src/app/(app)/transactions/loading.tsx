import { Skeleton } from "@/components/ui/skeleton"

// Mirrors the real layout: a fixed toolbar over a card panel whose day-grouped
// list is the only scroll region. Deterministic widths keep it from shimmering.
const GROUPS = [4, 3, 5, 3]

export default function TransactionsLoading() {
  let row = 0
  return (
    <div className="flex h-full justify-center">
      <div className="bg-card border-border/60 flex h-full w-full max-w-3xl flex-col border-x">
        {/* Toolbar mirror */}
        <div className="shrink-0 border-b">
          <div className="flex items-center gap-2 px-3 py-2">
            <Skeleton className="hidden h-8 w-32 md:block" />
            <Skeleton className="hidden h-8 w-36 md:block" />
            <Skeleton className="h-8 min-w-0 flex-1 md:w-52 md:flex-none" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>

        {/* Day-grouped list mirror */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {GROUPS.map((count, g) => (
            <section key={g}>
              <div className="bg-muted/30 flex items-center justify-between px-3 py-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-14" />
              </div>
              {Array.from({ length: count }).map((_, i) => {
                const idx = row++
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-[7px]">
                    <Skeleton
                      className="h-4 shrink-0"
                      style={{ width: `${90 + ((idx * 37) % 120)}px` }}
                    />
                    <div className="flex-1" />
                    <Skeleton className="h-3.5 w-16 shrink-0" />
                    <Skeleton className="h-4 w-16 shrink-0" />
                    <Skeleton className="size-6 shrink-0 rounded-md" />
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
