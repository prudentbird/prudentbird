import Spotify from "./spotify";
import { Suspense } from "react";
import { ActivityTabs } from "./activity-tabs";
import { SpotifySkeleton } from "./spotify-skeleton";
import { ActivityHistory } from "./activity-history";

export function Activity() {
  return (
    <ActivityTabs
      nowPlaying={
        <Suspense fallback={<SpotifySkeleton />}>
          <Spotify />
        </Suspense>
      }
      history={
        <Suspense
          fallback={
            <div className="flex h-32 items-center justify-center rounded-lg border border-border/50 bg-muted/20 text-sm text-muted-foreground animate-pulse">
              Loading history...
            </div>
          }
        >
          <ActivityHistory />
        </Suspense>
      }
    />
  );
}
