"use client";

import {
  getSpotifyTrack,
  type SpotifyTrack,
  revalidateSpotifyCurrent,
} from "~/app/actions/spotify";
import useSWR from "swr";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { formatTimeAgo } from "~/lib/utils";
import { Player } from "~/components/player";
import { MarqueeText } from "./marquee-text";
import { SpotifySkeleton } from "./spotify-skeleton";
import { useEffect, useEffectEvent, startTransition } from "react";

export function SpotifyWidget({
  initialTrack,
}: {
  initialTrack: SpotifyTrack | null;
}) {
  const {
    data: track,
    isLoading,
    mutate,
  } = useSWR("spotify-current", getSpotifyTrack, {
    keepPreviousData: true,
    revalidateOnFocus: true,
    revalidateOnMount: true,
    revalidateOnReconnect: false,
    fallbackData: initialTrack,
  });

  const handleRefresh = useEffectEvent(() => {
    startTransition(async () => {
      await revalidateSpotifyCurrent();
      mutate();
    });
  });

  useEffect(() => {
    if (!track?.isPlaying) return;
    const timeRemaining = track.duration - track.progress;
    const delay = timeRemaining <= 2000 ? 3000 : timeRemaining + 500;
    const timeout = setTimeout(handleRefresh, delay);
    return () => clearTimeout(timeout);
  }, [track]);

  if (isLoading || !track) return <SpotifySkeleton />;

  const playerKey = [
    track.url,
    track.playedAt ?? "playing",
    track.duration,
    track.progress,
    track.isPlaying ? "playing" : "paused",
  ].join(":");

  return (
    <div className="w-full rounded-lg">
      <div className="border border-border rounded-lg p-4 sm:p-6 dark:bg-black/40">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row items-stretch gap-3">
            <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border/50">
              <Image
                width={128}
                height={128}
                loading="lazy"
                alt={track.name}
                src={track.images?.medium ?? track.imageUrl}
                className="w-full h-full object-cover"
                sizes="(max-width: 640px) 80px, 80px"
                decoding="async"
              />
            </div>

            <div className="flex flex-col flex-1 min-w-0 sm:h-20 justify-between">
              <div className="flex items-center justify-end">
                <a
                  href={track.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-sm text-muted-foreground hover:underline hover:text-foreground"
                  suppressHydrationWarning
                >
                  {track.playedAt
                    ? formatTimeAgo(track.playedAt)
                    : "Now Playing"}
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="flex items-end min-w-0">
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <MarqueeText
                    text={track.name}
                    className="text-lg sm:text-xl font-semibold text-foreground"
                  />
                  <MarqueeText
                    text={track.artist}
                    className="text-sm sm:text-base text-muted-foreground"
                  />
                </div>
              </div>
            </div>
          </div>

          <Player
            key={playerKey}
            progressMs={track.progress}
            durationMs={track.duration}
            isPlaying={track.isPlaying}
          />
        </div>
      </div>
    </div>
  );
}
