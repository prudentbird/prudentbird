"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import type { DayActivity } from "~/lib/listening/activity";
import { estimateProgressMs } from "~/lib/listening/progress";
import type { SpotifyTrack } from "~/lib/listening/spotify-track";

const PLAYING_POLL_MS = 15_000;
const IDLE_POLL_MS = 30_000;
const HISTORY_POLL_MS = 10 * 60_000;
const SONG_END_GRACE_MS = 1_500;

type SpotifySnapshot = { track: SpotifyTrack | null; receivedAt: number };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} failed (${response.status})`);
  return response.json();
}

export function useNowPlaying() {
  const { data, isLoading, mutate } = useSWR(
    "/api/now-playing",
    getJson<SpotifySnapshot>,
    {
      keepPreviousData: true,
      revalidateOnFocus: true,
      refreshInterval: (latest) =>
        latest?.track?.isPlaying ? PLAYING_POLL_MS : IDLE_POLL_MS,
      errorRetryInterval: 15_000,
    },
  );
  const track = data?.track ?? null;
  const receivedAt = data?.receivedAt ?? 0;

  useEffect(() => {
    if (!track?.isPlaying || !track.duration) return;
    const remaining =
      track.duration - estimateProgressMs({ ...track, receivedAt }, Date.now());
    const id = setTimeout(
      () => {
        if (!document.hidden) void mutate();
      },
      Math.max(1_000, remaining + SONG_END_GRACE_MS),
    );
    return () => clearTimeout(id);
  }, [track, receivedAt, mutate]);

  return { track, receivedAt, isLoading };
}

export function useListeningHistory() {
  const { data, isLoading } = useSWR(
    "/api/listening-history",
    getJson<DayActivity[]>,
    {
      revalidateOnFocus: true,
      refreshInterval: HISTORY_POLL_MS,
      keepPreviousData: true,
    },
  );
  return { history: data ?? null, isLoading };
}

export function useTrackProgress(
  track: SpotifyTrack | null,
  receivedAt: number,
) {
  const [clock, setClock] = useState(0);

  useEffect(() => {
    if (!track?.isPlaying) return;
    const id = setInterval(() => setClock(Date.now()), 500);
    return () => clearInterval(id);
  }, [track]);

  if (!track || !track.duration) return 0;
  return estimateProgressMs({ ...track, receivedAt }, clock) / track.duration;
}

export function trackHref(track: SpotifyTrack) {
  return (
    track.url ||
    `https://open.spotify.com/search/${encodeURIComponent(`${track.name} ${track.artist}`)}`
  );
}
