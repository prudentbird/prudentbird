"use client";

import { Progress } from "~/components/ui/progress";
import { memo, useEffect, useMemo, useRef, useState } from "react";

function PlayerComponent({
  progressMs,
  durationMs,
  isPlaying,
}: {
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
}) {
  const [currentMs, setCurrentMs] = useState(progressMs);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    setCurrentMs(progressMs);
  }, [progressMs]);

  useEffect(() => {
    function step(ts: number) {
      if (!isPlaying) return;

      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
      } else {
        const delta = ts - lastTsRef.current;
        lastTsRef.current = ts;
        setCurrentMs((prev) => Math.min(durationMs, prev + delta));
      }

      rafRef.current = requestAnimationFrame(step);
    }

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(step);
    } else {
      lastTsRef.current = null;
    }
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, durationMs]);

  const percent = useMemo(() => {
    if (!durationMs || durationMs <= 0) return 0;
    return Math.max(0, Math.min(100, (currentMs / durationMs) * 100));
  }, [currentMs, durationMs]);

  const formatMillisecondsToMinutesSeconds = (milliseconds: number): string => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2">
      <Progress
        value={percent}
        className="h-1.5 bg-border/30"
        indicatorClassName="bg-[#1DB954]"
        aria-label="Playback progress"
        aria-valuetext={`${formatMillisecondsToMinutesSeconds(currentMs)} of ${formatMillisecondsToMinutesSeconds(durationMs)}`}
      />
      <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
        <span>{formatMillisecondsToMinutesSeconds(currentMs)}</span>
        <span>{formatMillisecondsToMinutesSeconds(durationMs)}</span>
      </div>
    </div>
  );
}

export const Player = memo(PlayerComponent, (prev, next) => {
  return (
    prev.progressMs === next.progressMs &&
    prev.durationMs === next.durationMs &&
    prev.isPlaying === next.isPlaying
  );
});
