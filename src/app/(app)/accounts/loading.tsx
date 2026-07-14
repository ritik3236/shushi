import { Skeleton } from "@/components/ui/skeleton"

export default function AccountsLoading() {
  return (
    <>
      <div className="mb-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-8 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4" style={{ width: `${40 + ((i * 13) % 35)}%` }} />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="mt-3 space-y-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-7" style={{ width: `${45 + ((i * 17) % 30)}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-2">
              <Skeleton className="h-3" style={{ width: `${45 + ((i * 11) % 25)}%` }} />
              <Skeleton className="h-7 w-12" />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
