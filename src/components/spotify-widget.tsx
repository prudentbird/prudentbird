"use client";

import Image from "next/image";
import { Music2 } from "lucide-react";
import { Player } from "~/components/player";
import {
  getSpotifyTrack,
  revalidateSpotifyCurrent,
  type SpotifyTrack,
} from "~/app/actions/spotify";
import useSWR from "swr";
import { SpotifySkeleton } from "./spotify-skeleton";
import { formatTimeAgo } from "~/lib/utils";
import { Button } from "./ui/button";
import { Spotify } from "./ui/svgs/spotify";
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
    revalidateOnMount: false,
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

    if (timeRemaining <= 2000) {
      const timeout = setTimeout(handleRefresh, 3000);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(handleRefresh, timeRemaining + 500);
    return () => clearTimeout(timeout);
  }, [track]);

  if (isLoading) {
    return <SpotifySkeleton />;
  }

  if (!track) {
    return <SpotifySkeleton />;
  }

  return (
    <div className="group relative block w-full rounded-lg">
      <a
        href={track.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Visit ${track.name}`}
        className="absolute inset-0 z-10"
      />
      <div className="border border-border rounded-lg p-4 sm:p-6 dark:bg-black/40">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
          <div className="relative flex-shrink-0 self-center sm:self-auto">
            <div className="w-32 h-32 rounded-lg overflow-hidden border border-border/50">
              <Image
                width={128}
                height={128}
                loading="lazy"
                alt={track.name}
                src={track.images?.medium ?? track.imageUrl}
                className="w-full h-full object-cover"
                sizes="128px"
                decoding="async"
                placeholder={track.blurDataURL ? "blur" : undefined}
                blurDataURL={track.blurDataURL}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 justify-between w-full min-w-0 self-stretch">
            <div className="flex items-center justify-start sm:justify-end gap-2">
              <Music2 className="w-4 h-4 text-muted-foreground" />
              <span
                className="text-sm text-muted-foreground"
                suppressHydrationWarning
              >
                {track.playedAt ? formatTimeAgo(track.playedAt) : "Now Playing"}
              </span>
            </div>

            <div className="flex flex-col h-full gap-4 sm:gap-2 justify-end">
              <div className="flex flex-row gap-2 justify-between items-end min-w-0">
                <div className="flex flex-col sm:gap-1 w-full min-w-0 max-w-[70%]">
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground truncate w-full">
                    {track.name}
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground truncate w-full">
                    {track.artist}
                  </p>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="relative z-20"
                >
                  <a
                    href={track.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visit ${track.name}`}
                  >
                    <Spotify className="size-4" />
                    <span className="hidden sm:block">Play</span>
                  </a>
                </Button>
              </div>
              <Player
                progressMs={track.progress}
                durationMs={track.duration}
                isPlaying={track.isPlaying}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
