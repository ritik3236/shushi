import { Skeleton } from "@/components/ui/skeleton"

export default function CategoriesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>

      {[6, 2, 2].map((rows, groupIndex) => (
        <div key={groupIndex}>
          <Skeleton className="mb-1.5 ml-2 h-3 w-16" />
          <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex h-8 items-center gap-2 px-2">
                <Skeleton className="size-2.5 rounded-full" />
                <Skeleton
                  className="h-4"
                  style={{ width: `${28 + (((groupIndex * 7 + i) * 13) % 30)}%` }}
                />
                <Skeleton className="ml-auto h-3 w-6" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div>
        <Skeleton className="mb-1.5 ml-2 h-3 w-16" />
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex h-9 items-center gap-4 border-b last:border-0">
              <Skeleton className="h-3" style={{ width: `${16 + ((i * 13) % 20)}%` }} />
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3" style={{ width: `${12 + ((i * 17) % 15)}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
