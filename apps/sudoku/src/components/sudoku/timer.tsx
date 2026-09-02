"use client";

import { useNow } from "~/hooks/use-now";
import { formatDuration } from "~/lib/utils";

export function Timer({
  startedAt,
  finishedAt,
  className,
}: {
  startedAt?: number;
  finishedAt?: number;
  className?: string;
}) {
  const now = useNow(1000);
  const end = finishedAt ?? now;
  const elapsed = startedAt ? end - startedAt : 0;
  return (
    <span className={`font-mono tabular-nums ${className ?? ""}`}>
      {formatDuration(elapsed)}
    </span>
  );
}
