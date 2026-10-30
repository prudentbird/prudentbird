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

