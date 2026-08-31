"use server";

import { env } from "~/env";

export type DailyActivity = {
  date: string;
  count: number;
  tracks: Array<{
    name: string;
    artist: string;
    url: string;
    playedAt: string;
  }>;
};

const BATCH_SIZE = 5;

async function fetchPages(urls: string[]): Promise<unknown[]> {
  const results: unknown[] = [];
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((url) =>
        fetch(url, { next: { revalidate: 3600 } }).then((r) =>
          r.ok ? r.json() : null,
        ),
      ),
    );
    results.push(...batchResults);
  }
  return results;
}

export async function getLastFmHistory(): Promise<DailyActivity[]> {
  const limit = 200;
  const base = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${env.LASTFM_USERNAME}&api_key=${env.LASTFM_API_KEY}&format=json&limit=${limit}`;

  try {
    const firstRes = await fetch(`${base}&page=1`, {
      next: { revalidate: 3600 },
    });
    if (!firstRes.ok) return [];
    const firstData = await firstRes.json();

    const totalPages = parseInt(
      firstData?.recenttracks?.["@attr"]?.totalPages ?? "1",
      10,
    );

    const remaining =
      totalPages > 1
        ? await fetchPages(
            Array.from(
              { length: totalPages - 1 },
              (_, i) => `${base}&page=${i + 2}`,
            ),
          )
        : [];

    const allPages = [firstData, ...remaining];
    const activityMap = new Map<string, DailyActivity>();

    for (const data of allPages) {
      if (!data?.recenttracks?.track) continue;

      const tracks = Array.isArray(data.recenttracks.track)
        ? data.recenttracks.track
        : [data.recenttracks.track];

      for (const track of tracks) {
        if (!track.date?.uts) continue;
        const dateObj = new Date(parseInt(track.date.uts, 10) * 1000);
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const d = String(dateObj.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${d}`;

        if (!activityMap.has(dateStr)) {
          activityMap.set(dateStr, { date: dateStr, count: 0, tracks: [] });
        }

        const dayData = activityMap.get(dateStr)!;
        dayData.count += 1;
        dayData.tracks.push({
          name: track.name,
          artist:
            track.artist?.["#text"] || track.artist?.name || "Unknown Artist",
          url: track.url,
          playedAt: dateObj.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
        });
      }
    }

    return Array.from(activityMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  } catch (error) {
    console.error("Failed to fetch Last.fm history:", error);
    return [];
  }
}
