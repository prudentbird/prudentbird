"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { getLastFmHistory } from "~/app/actions/lastfm";
import { getSpotifyTrack } from "~/app/actions/spotify";
import { estimateProgressMs } from "~/lib/listening/progress";
import type { SpotifyTrack } from "~/lib/listening/spotify-track";

const PLAYING_POLL_MS = 15_000;
const IDLE_POLL_MS = 20_000;
const HISTORY_POLL_MS = 5 * 60_000;
/** Re-check this long after the song should have ended, to catch the next one. */
const SONG_END_GRACE_MS = 1_500;

export function useNowPlaying() {
  const { data, isLoading, mutate } = useSWR(
    "spotify-current",
    async () => {
      const sent = Date.now();
      const track = await getSpotifyTrack();
      // Spotify's progress was true roughly mid-flight, not when we got it.
      return { track, receivedAt: (sent + Date.now()) / 2 };
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: true,
      refreshInterval: (latest) =>
        latest?.track?.isPlaying ? PLAYING_POLL_MS : IDLE_POLL_MS,
      // Spotify errors and rate limits keep the last known track on screen.
      errorRetryInterval: 15_000,
    },
  );
  const track = data?.track ?? null;
  const receivedAt = data?.receivedAt ?? 0;

  // Don't wait for the next poll to notice the song changed.
  useEffect(() => {
    if (!track?.isPlaying || !track.duration) return;
    const remaining =
      track.duration - estimateProgressMs({ ...track, receivedAt }, Date.now());
    const id = setTimeout(
      () => void mutate(),
      Math.max(1_000, remaining + SONG_END_GRACE_MS),
    );
    return () => clearTimeout(id);
  }, [track, receivedAt, mutate]);

  return { track, receivedAt, isLoading };
}

export function useListeningHistory() {
  const { data, isLoading } = useSWR("lastfm-history", getLastFmHistory, {
    revalidateOnFocus: true,
    refreshInterval: HISTORY_POLL_MS,
    keepPreviousData: true,
  });
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
