"use client";

import { Progress } from "~/components/ui/progress";
import { useEffect, useRef, useState, useMemo } from "react";

export function Player({
  progressMs,
  durationMs,
  isPlaying,
}: {
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
}) {
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const [currentMs, setCurrentMs] = useState(progressMs);

  const [prevProgressMs, setPrevProgressMs] = useState(progressMs);
  if (progressMs !== prevProgressMs) {
    setPrevProgressMs(progressMs);
    setCurrentMs(progressMs);
  }

  useEffect(() => {
    lastTsRef.current = null;
  }, [progressMs]);

  useEffect(() => {
    if (!isPlaying) {
      lastTsRef.current = null;
      return;
    }

    const step = (ts: number) => {
      if (lastTsRef.current === null) {
        lastTsRef.current = ts;
      } else {
        const delta = ts - lastTsRef.current;
        lastTsRef.current = ts;
        setCurrentMs((prev) => Math.min(durationMs, prev + delta));
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying, durationMs]);

  const percent = useMemo(() => {
    if (!durationMs || durationMs <= 0) return 0;
    return Math.max(0, Math.min(100, (currentMs / durationMs) * 100));
  }, [currentMs, durationMs]);

  const formatTime = useMemo(
    () => (ms: number) => {
      const totalSeconds = Math.max(0, Math.floor(ms / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    },
    [],
  );

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2">
      <Progress
        value={percent}
        className="h-1.5 bg-border/30"
        indicatorClassName="bg-[#1DB954]"
        aria-label="Playback progress"
        aria-valuetext={`${formatTime(currentMs)} of ${formatTime(durationMs)}`}
      />
      <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
        <span>{formatTime(currentMs)}</span>
        <span>{formatTime(durationMs)}</span>
      </div>
    </div>
  );
}
