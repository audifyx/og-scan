import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Main card skeleton */}
      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24 bg-muted" />
            <Skeleton className="h-12 w-48 bg-muted" />
            <Skeleton className="h-4 w-40 bg-muted" />
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="h-4 w-20 ml-auto bg-muted" />
            <Skeleton className="h-8 w-24 ml-auto bg-muted" />
            <Skeleton className="h-4 w-16 ml-auto bg-muted" />
          </div>
        </div>
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card p-4 md:p-5">
            <Skeleton className="h-10 w-10 rounded-lg mb-3 bg-muted" />
            <Skeleton className="h-3 w-16 mb-2 bg-muted" />
            <Skeleton className="h-6 w-20 mb-1 bg-muted" />
            <Skeleton className="h-3 w-12 bg-muted" />
          </div>
        ))}
      </div>

      {/* Lists skeleton */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card">
          <div className="p-4 md:p-6 border-b border-border">
            <Skeleton className="h-6 w-32 bg-muted" />
          </div>
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full bg-muted" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24 bg-muted" />
                    <Skeleton className="h-3 w-12 bg-muted" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16 ml-auto bg-muted" />
                  <Skeleton className="h-3 w-12 ml-auto bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <div className="p-4 md:p-6 border-b border-border">
            <Skeleton className="h-6 w-40 bg-muted" />
          </div>
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg bg-muted" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20 bg-muted" />
                    <Skeleton className="h-3 w-28 bg-muted" />
                  </div>
                </div>
                <Skeleton className="h-4 w-20 bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
