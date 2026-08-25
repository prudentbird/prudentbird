import { Skeleton } from "./ui/skeleton";
import { TextSkeleton } from "./ui/text-skeleton";

const ROWS = 7;
const COLS = 50;

export function ScrobblerSkeleton() {
  return (
    <div className="flex h-32 flex-col justify-center gap-3 overflow-hidden rounded-lg border border-border/50 bg-muted/20 p-4">
      <div className="flex flex-col gap-1">
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} className="flex gap-1">
            {Array.from({ length: COLS }, (_, col) => (
              <Skeleton key={col} className="size-2.5 shrink-0 rounded-sm" />
            ))}
          </div>
        ))}
      </div>
      <TextSkeleton className="w-24 text-xs" />
    </div>
  );
}
