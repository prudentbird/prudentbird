import { Skeleton } from "./ui/skeleton";

export function SpotifySkeleton() {
  return (
    <div className="w-full rounded-lg">
      <div className="border border-border rounded-lg p-4 sm:p-6 dark:bg-black/40">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
          <div className="relative flex-shrink-0 self-center sm:self-auto">
            <Skeleton className="w-32 h-32 rounded-lg border border-border/50" />
          </div>

          <div className="flex flex-col gap-2 justify-between w-full self-stretch">
            <div className="flex items-center justify-start sm:justify-end">
              <Skeleton className="w-24 h-4" />
            </div>

            <div className="flex flex-col h-full gap-4 sm:gap-2 justify-end">
              <div className="flex flex-row gap-2 justify-between items-end min-w-0">
                <div className="flex flex-col sm:gap-1 w-full min-w-0 max-w-[70%]">
                  <Skeleton className="h-6 sm:h-7 w-3/4 mb-1" />
                  <Skeleton className="h-5 sm:h-6 w-1/2" />
                </div>
                <Skeleton className="w-8 sm:w-16 h-6" />
              </div>

              <div className="flex flex-col gap-1.5 sm:gap-2">
                <Skeleton className="h-1.5 w-full rounded-full" />
                <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                  <Skeleton className="w-8 h-3" />
                  <Skeleton className="w-8 h-3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
