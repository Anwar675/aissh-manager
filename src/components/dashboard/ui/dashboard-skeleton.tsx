import { Skeleton } from "@/components/ui/skeleton";

type DashboardSkeletonProps = {
  message?: string;
};

export function DashboardSkeleton({ message }: DashboardSkeletonProps) {
  return (
    <div className="space-y-4 px-4 py-4 lg:px-6">
      {message ? (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="hidden h-8 w-24 md:block" />
          <Skeleton className="hidden h-8 w-24 md:block" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[48px_48px_1.4fr_1.2fr_80px_1fr_1fr_1fr_90px_48px] gap-3 border-b bg-muted px-4 py-3">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>

        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-[48px_48px_1.4fr_1.2fr_80px_1fr_1fr_1fr_90px_48px] items-center gap-3 px-4 py-4"
            >
              <Skeleton className="size-5" />
              <Skeleton className="size-4" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="size-8" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-4">
        <Skeleton className="hidden h-5 w-44 lg:block" />
        <div className="ml-auto flex items-center gap-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="size-8" />
          <Skeleton className="size-8" />
        </div>
      </div>
    </div>
  );
}
