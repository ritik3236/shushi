import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const ROW_COUNT = 12

export default function TransactionsLoading() {
  return (
    <>
      <div className="space-y-3">
        {/* Controls row mirror */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="hidden h-8 w-32 md:block" />
          <Skeleton className="hidden h-8 w-36 md:block" />
          <Skeleton className="hidden h-8 w-52 md:block" />
          <Skeleton className="h-8 min-w-0 flex-1 md:w-52 md:flex-none" />
          <Skeleton className="h-8 w-24" />
        </div>
        {/* Table card mirror */}
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex h-10 items-center gap-4 border-b px-2">
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="h-3.5 w-16" />
            <div className="flex-1" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-14" />
          </div>
          <div>
            {Array.from({ length: ROW_COUNT }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b px-2 py-2 last:border-b-0"
              >
                <Skeleton className="h-4 w-12 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4" style={{ width: `${60 + ((i * 13) % 35)}%` }} />
                  <Skeleton className="h-3" style={{ width: `${30 + ((i * 7) % 40)}%` }} />
                </div>
                <Skeleton className="hidden h-3 w-24 shrink-0 lg:block" />
                <Skeleton className="h-7 w-40 shrink-0" />
                <Skeleton className="h-4 w-20 shrink-0" />
                <Skeleton className="size-7 shrink-0 rounded-md" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t px-4 py-2">
            <Skeleton className="h-4 w-40" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-7 w-14" />
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
