import Spotify from "./spotify";
import { Suspense } from "react";
import { SpotifySkeleton } from "./spotify-skeleton";

export function Stats() {
  return (
    <section>
      <h2 className="mb-8 text-2xl font-semibold">Activity</h2>
      <Suspense fallback={<SpotifySkeleton />}>
        <Spotify />
      </Suspense>
    </section>
  );
}
