"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { getLastFmHistory } from "~/app/actions/lastfm";
import { getSpotifyTrack, type SpotifyTrack } from "~/app/actions/spotify";

export function useNowPlaying() {
  const { data, isLoading } = useSWR("spotify-current", getSpotifyTrack, {
    keepPreviousData: true,
    revalidateOnFocus: true,
    refreshInterval: (track) => (track?.isPlaying ? 20_000 : 90_000),
  });
  return { track: data ?? null, isLoading };
}

export function useListeningHistory() {
  const { data, isLoading } = useSWR("lastfm-history", getLastFmHistory, {
    revalidateOnFocus: false,
  });
  return { history: data ?? null, isLoading };
}

export function useTrackProgress(track: SpotifyTrack | null) {
  const [tick, setTick] = useState<{ key: SpotifyTrack | null; ms: number }>({
    key: null,
    ms: 0,
  });

  useEffect(() => {
    if (!track?.isPlaying) return;
    const start = performance.now();
    const id = setInterval(
      () => setTick({ key: track, ms: performance.now() - start }),
      500,
    );
    return () => clearInterval(id);
  }, [track]);

  if (!track || !track.duration) return 0;
  const elapsed = track.isPlaying && tick.key === track ? tick.ms : 0;
  return Math.min(1, (track.progress + elapsed) / track.duration);
}

export function trackHref(track: SpotifyTrack) {
  return (
    track.url ||
    `https://open.spotify.com/search/${encodeURIComponent(`${track.name} ${track.artist}`)}`
  );
}
