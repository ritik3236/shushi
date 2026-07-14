import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const ROW_COUNT = 10

const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_6.5rem] sm:grid-cols-[minmax(7rem,1fr)_6rem_6rem_6.5rem] items-center gap-2 px-3"

/** Layout-mirroring skeleton: KPI strip, controls row, then the ledger card. */
export default function PeopleLoading() {
  return (
    <div className="space-y-3">
      {/* KPI strip mirror */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} size="sm">
            <CardContent>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-1.5 h-5 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls row mirror */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-full sm:w-56" />
        <Skeleton className="h-8 w-64" />
      </div>

      {/* Ledger card mirror */}
      <Card className="gap-0 overflow-hidden py-0">
        <div className={`${ROW_GRID} border-b py-2`}>
          <Skeleton className="h-3 w-12" />
          <Skeleton className="ml-auto hidden h-3 w-10 sm:block" />
          <Skeleton className="ml-auto hidden h-3 w-12 sm:block" />
          <Skeleton className="ml-auto h-3 w-8" />
        </div>
        <div className="divide-border divide-y">
          {Array.from({ length: ROW_COUNT }).map((_, i) => (
            <div key={i} className={`${ROW_GRID} py-2`}>
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-4" style={{ width: `${45 + ((i * 13) % 40)}%` }} />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="ml-auto hidden h-4 w-14 sm:block" />
              <Skeleton className="ml-auto hidden h-4 w-14 sm:block" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
