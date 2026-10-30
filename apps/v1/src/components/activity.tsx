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
      history={<ActivityHistory />}
    />
  );
}
