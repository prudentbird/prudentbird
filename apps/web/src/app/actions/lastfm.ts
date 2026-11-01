import { cacheLife } from "next/cache";
import { env } from "~/env";
import { bucketScrobbles, type DayActivity } from "~/lib/listening/activity";
import { dayKey, LISTENING_TIME_ZONE, shiftDayKey } from "~/lib/listening/time";

export type { DayActivity };

const PAGE_SIZE = 200;
const HISTORY_DAYS = 180;
const BATCH_SIZE = 5;

type RecentTracks = {
  error?: number;
  message?: string;
  recenttracks?: {
    "@attr"?: { totalPages?: string };
    track?: RawScrobble | RawScrobble[];
  };
};

type RawScrobble = {
  date?: { uts: string };
  artist?: { "#text"?: string; name?: string };
};

async function fetchPage(url: string): Promise<RecentTracks> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url);
    if (response.ok) {
      const data = (await response.json()) as RecentTracks;
      if (data.error !== undefined || !data.recenttracks)
        throw new Error(
          `Last.fm API failed (${data.error ?? "invalid response"})`,
        );
      return data;
    }
    if (attempt >= 1)
      throw new Error(`Last.fm request failed (${response.status})`);
  }
}

export async function getLastFmHistory(): Promise<DayActivity[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });

  const now = Date.now();
  const windowStart = shiftDayKey(dayKey(now), -(HISTORY_DAYS - 1));
  const from = Math.floor(now / 1000) - (HISTORY_DAYS + 1) * 86_400;
  const params = new URLSearchParams({
    method: "user.getrecenttracks",
    user: env.LASTFM_USERNAME,
    api_key: env.LASTFM_API_KEY,
    format: "json",
    limit: String(PAGE_SIZE),
    from: String(from),
    to: String(Math.floor(now / 1000)),
  });
  const url = (page: number) =>
    `https://ws.audioscrobbler.com/2.0/?${params}&page=${page}`;

  const first = await fetchPage(url(1));
  const totalPages =
    Number(first.recenttracks?.["@attr"]?.totalPages ?? 1) || 1;
  const pages = [first];
  const last = totalPages;
  for (let page = 2; page <= last; page += BATCH_SIZE) {
    const batch = Array.from(
      { length: Math.min(BATCH_SIZE, last - page + 1) },
      (_, i) => fetchPage(url(page + i)),
    );
    pages.push(...(await Promise.all(batch)));
  }

  const scrobbles = pages.flatMap((data) => {
    const track = data.recenttracks?.track ?? [];
    return (Array.isArray(track) ? track : [track]).flatMap((t) =>
      t.date?.uts
        ? [
            {
              uts: Number(t.date.uts),
              artist: t.artist?.["#text"] || t.artist?.name || "Unknown Artist",
            },
          ]
        : [],
    );
  });

  return bucketScrobbles(scrobbles, {
    minDate: windowStart,
    timeZone: LISTENING_TIME_ZONE,
  });
}
