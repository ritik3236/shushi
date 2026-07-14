import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const TABLE_ROWS = 6

/** Layout-mirroring skeleton: controls row, KPI strip, then the table card. */
export default function PayslipsLoading() {
  return (
    <div className="space-y-4">
      {/* Controls row mirror */}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-8 w-[130px]" />
      </div>

      {/* KPI mini-row mirror */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} size="sm">
            <CardContent>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-1.5 h-5 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table card mirror */}
      <Card size="sm">
        <CardContent>
          <div className="space-y-0">
            {Array.from({ length: TABLE_ROWS }).map((_, i) => (
              <div
                key={i}
                className="flex h-10 items-center gap-3 border-b last:border-0"
              >
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-5 w-14 rounded-4xl" />
                <Skeleton
                  className="h-3.5"
                  style={{ width: `${14 + ((i * 13) % 22)}%` }}
                />
                <Skeleton className="ml-auto h-3.5 w-24" />
                <Skeleton
                  className="h-3.5"
                  style={{ width: `${10 + ((i * 7) % 14)}%` }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
