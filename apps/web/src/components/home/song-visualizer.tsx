"use client";

import Image from "next/image";
import { Loader2, Music2, Pause, Play, Square } from "lucide-react";
import { useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { TextSkeleton } from "~/components/ui/text-skeleton";
import { cn } from "~/lib/utils";
import { externalProps } from "~/lib/content";
import {
  trackHref,
  useListeningHistory,
  useNowPlaying,
  useTrackProgress,
} from "~/lib/live";
import { findYouTubeMatch } from "~/app/actions/youtube";
import { PLAYING, type YTPlayer, loadYouTubeApi } from "./youtube-player";

const BAR = 10;
const GAP = 3;
const DAY = 86_400_000;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () =>
    ((s =
      Math.imul(s ^ (s >>> 15), 2246822507) ^
      Math.imul(s ^ (s >>> 13), 3266489909)) >>>
      0) /
    4294967296;
}

/** Each track's own bar shape: louder passages over a quieter floor. */
function fingerprint(count: number, seed: number) {
  const r = rng(seed);
  const bumps = Array.from({ length: 4 }, () => ({
    c: r(),
    w: 0.06 + r() * 0.18,
    a: 0.4 + r() * 0.6,
  }));
  const bars = Array.from({ length: count }, (_, i) => {
    const x = i / Math.max(1, count - 1);
    const env = bumps.reduce(
      (v, b) => v + b.a * Math.exp(-((x - b.c) ** 2) / (2 * b.w ** 2)),
      0,
    );
    return (
      (0.25 + env * 0.6 + r() * 0.25) *
      (0.35 + 0.65 * Math.min(1, x * 12, (1 - x) * 12))
    );
  });
  const max = Math.max(...bars);
  return {
    heights: bars.map((b) => Math.max(0.06, b / max)),
    motion: bars.map(() => ({ f: 1.6 + r() * 3.2, p: r() * Math.PI * 2 })),
    beat: 60 / (84 + Math.floor(r() * 50)),
  };
}

