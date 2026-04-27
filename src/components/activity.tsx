import Spotify from "./spotify";
import { Suspense } from "react";
import { SpotifySkeleton } from "./spotify-skeleton";

export function Activity() {
  return (
    <section>
      <h2 className="mb-6 text-2xl md:text-3xl font-semibold">Activity</h2>
      <Suspense fallback={<SpotifySkeleton />}>
        <Spotify />
      </Suspense>
    </section>
  );
}
