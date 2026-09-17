"use client";

import { useEffect, useState } from "react";

/**
 * Current time, re-rendering every `intervalMs`. Pass `active: false` to
 * freeze it — a paused or finished clock has nothing to re-render for. The
 * frozen value goes stale, so it is only safe to read while active, or where
 * the reader ignores it (`clockElapsed` does while paused).
 */
export function useNow(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return now;
}
