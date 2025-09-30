"use client";

import Image from "next/image";
import { Music2 } from "lucide-react";
import { use, startTransition } from "react";
import { Player } from "~/components/player";
import {
  getSpotifyTrack,
  revalidateSpotifyCurrent,
  type SpotifyTrack,
} from "~/app/actions/spotify";
import useSWR from "swr";
import { SpotifySkeleton } from "./spotify-skeleton";
import { Button } from "./ui/button";
import { Spotify } from "./ui/svgs/spotify";

export function SpotifyWidget({
  initialTrack,
}: {
  initialTrack: Promise<SpotifyTrack | null>;
}) {
  const {
    data: track,
    isLoading,
    mutate,
  } = useSWR("spotify-current", async () => await getSpotifyTrack(), {
    fallbackData: use(initialTrack),
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  if (isLoading) {
    return <SpotifySkeleton />;
  }

  if (!track) {
    return null;
  }

  const handleRefresh = () => {
    startTransition(async () => {
      await revalidateSpotifyCurrent();
      mutate();
    });
  };

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
                placeholder={track.blurDataURL ? "blur" : undefined}
                blurDataURL={track.blurDataURL}
              />
            </div>
          </div>

          <div
            className="flex flex-col gap-2 justify-between h-full w-full min-w-0"
            style={{ height: "-webkit-fill-available" }}
          >
            <div className="flex items-center justify-start sm:justify-end gap-2">
              <Music2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Now Playing</span>
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
                onEnded={handleRefresh}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
