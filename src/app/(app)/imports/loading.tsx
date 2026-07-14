import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const HISTORY_ROWS = 6

export default function ImportsLoading() {
  return (
    <>
      {/* PageHeader mirror */}
      <div className="mb-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-1.5 h-4 w-96 max-w-full" />
      </div>

      {/* Drop-zone mirror */}
      <Skeleton className="h-28 w-full rounded-lg" />

      {/* History card mirror */}
      <Card size="sm" className="mt-4">
        <CardHeader>
          <Skeleton className="h-4 w-16" />
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {Array.from({ length: HISTORY_ROWS }).map((_, i) => (
              <div
                key={i}
                className="flex h-10 items-center gap-3 border-b last:border-0"
              >
                <Skeleton
                  className="h-3.5"
                  style={{ width: `${18 + ((i * 13) % 20)}%` }}
                />
                <Skeleton className="h-5 w-10 rounded-4xl" />
                <Skeleton
                  className="h-3.5"
                  style={{ width: `${16 + ((i * 7) % 18)}%` }}
                />
                <Skeleton className="ml-auto h-3.5 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
