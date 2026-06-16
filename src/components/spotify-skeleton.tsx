import { Skeleton } from "./ui/skeleton";

export function SpotifySkeleton() {
  return (
    <div className="w-full rounded-lg">
      <div className="border border-border rounded-lg p-4 sm:p-6 dark:bg-black/40">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row items-stretch gap-3">
            <Skeleton className="w-20 h-20 shrink-0 rounded-lg border border-border/50" />

            <div className="flex flex-col flex-1 min-w-0 sm:h-20 justify-between">
              <div className="flex items-center justify-end">
                <Skeleton className="w-24 h-4" />
              </div>

              <div className="flex items-end gap-2 min-w-0">
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <Skeleton className="h-6 sm:h-7 w-3/4" />
                  <Skeleton className="h-4 sm:h-5 w-1/2" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:gap-2">
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="w-8 h-3" />
              <Skeleton className="w-8 h-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
