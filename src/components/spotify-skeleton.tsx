import { Music2 } from "lucide-react";

export function SpotifySkeleton() {
  return (
    <div className="w-full rounded-lg">
      <div className="border border-border rounded-lg p-4 sm:p-6 dark:bg-black/40">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
          <div className="relative flex-shrink-0 self-center sm:self-auto">
            <div className="w-32 h-32 rounded-lg overflow-hidden border border-border/50 bg-muted animate-pulse" />
          </div>

          <div className="flex flex-col gap-2 justify-between w-full self-stretch">
            <div className="flex items-center justify-start sm:justify-end gap-2">
              <Music2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Now Playing</span>
            </div>

            <div className="flex flex-col h-full gap-4 sm:gap-2 justify-end">
              <div className="flex flex-col sm:gap-1">
                <div className="h-6 sm:h-7 bg-muted animate-pulse rounded w-3/4 mb-1" />
                <div className="h-5 sm:h-6 bg-muted animate-pulse rounded w-1/2" />
              </div>

              <div className="flex flex-col gap-1.5 sm:gap-2">
                <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-muted/50" />
                </div>
                <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                  <span className="bg-muted animate-pulse rounded w-8 h-3" />
                  <span className="bg-muted animate-pulse rounded w-8 h-3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
