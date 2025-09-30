import { Suspense } from "react";
import { SpotifyWidget } from "~/components/spotify";
import { SpotifySkeleton } from "./spotify-skeleton";
import { getSpotifyTrack } from "~/app/actions/spotify";

export function Stats() {
  const track = getSpotifyTrack();

  return (
    <section>
      <h2 className="mb-8 text-2xl font-semibold">Activity</h2>
      <Suspense fallback={<SpotifySkeleton />}>
        <SpotifyWidget initialTrack={track} />
      </Suspense>
    </section>
  );
}
