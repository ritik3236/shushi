import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Layout-mirroring skeleton: same grids, gaps and heights as page.tsx. */
export default function DashboardLoading() {
  return (
    <>
      <PageHeader title="Dashboard" actions={<Skeleton className="h-8 w-28" />} />
      <div className="space-y-3">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <Skeleton className="h-3" style={{ width: `${35 + ((i * 13) % 25)}%` }} />
                <Skeleton className="mt-2 h-7" style={{ width: `${60 + ((i * 13) % 35)}%` }} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trend + accounts */}
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-[220px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-20" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-1">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5" style={{ width: `${60 + ((i * 13) % 35)}%` }} />
                    <Skeleton className="h-3" style={{ width: `${40 + ((i * 17) % 30)}%` }} />
                  </div>
                  <Skeleton className="h-4 w-16 shrink-0" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Breakdown + payout / quick import */}
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="size-2 shrink-0 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-3.5" style={{ width: `${60 + ((i * 13) % 35)}%` }} />
                    </div>
                    <Skeleton className="h-3.5 w-14 shrink-0" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-col gap-3">
            <Card>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <div className="flex items-center justify-between gap-3 py-1">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-2/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-4 w-16 shrink-0" />
                </div>
              </CardContent>
            </Card>
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </>
  )
}
