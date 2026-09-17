"use client";

import type { GameClock } from "~/hooks/use-game-clock";
import { cn, formatDuration } from "~/lib/utils";

/**
 * The play clock, plus a pause control when the game can be paused. Shows
 * active time only, so a tab left in the background doesn't run it up.
 */
export function Timer({
  clock,
  className,
}: {
  clock: GameClock;
  className?: string;
}) {
  const time = (
    <span
      className={cn(
        "font-mono tabular-nums",
        clock.paused && "text-muted-foreground",
      )}
    >
      {formatDuration(clock.elapsedMs)}
    </span>
  );

  if (!clock.toggle) {
    return <span className={className}>{time}</span>;
  }

  return (
    <button
      type="button"
      onClick={clock.toggle}
      aria-label={clock.paused ? "Resume the timer" : "Pause the timer"}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      {time}
      <Glyph paused={clock.paused} />
    </button>
  );
}

function Glyph({ paused }: { paused: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className="size-3.5 shrink-0"
      fill="currentColor"
      aria-hidden="true"
    >
      {paused ? (
        <path d="M3 1.5 10 6l-7 4.5z" />
      ) : (
        <>
          <rect x="3" y="1.5" width="2.5" height="9" rx="0.5" />
          <rect x="6.5" y="1.5" width="2.5" height="9" rx="0.5" />
        </>
      )}
    </svg>
  );
}
