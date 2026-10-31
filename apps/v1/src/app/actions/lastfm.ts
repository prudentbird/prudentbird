"use server";

import { z } from "zod/v4";
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

const trackSchema = z.object({
  name: z.string(),
  artist: z.object({
    "#text": z.string().optional(),
    name: z.string().optional(),
  }),
  url: z.string(),
  date: z.object({ uts: z.string() }).optional(),
});
const pageSchema = z.object({
  recenttracks: z.object({
    track: z.union([z.array(trackSchema), trackSchema]),
    "@attr": z.object({ totalPages: z.string() }),
  }),
});

async function fetchRange(
  start: number,
  end: number,
): Promise<DailyActivity[]> {
  const params = new URLSearchParams({
    method: "user.getrecenttracks",
    user: env.LASTFM_USERNAME,
    api_key: env.LASTFM_API_KEY,
    format: "json",
    limit: "200",
    // Last.fm's lower bound is exclusive.
    from: String(start - 1),
    to: String(end),
  });
  async function fetchPage(page: number) {
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?${params}&page=${page}`,
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok)
      throw new Error(`Last.fm request failed: ${response.status}`);
    // API errors can also arrive with HTTP 200; reject them instead of showing empty history.
    return pageSchema.parse(await response.json()).recenttracks;
  }

  try {
    const first = await fetchPage(1);
    const totalPages = Number(first["@attr"].totalPages);
    if (!Number.isInteger(totalPages) || totalPages < 0 || totalPages > 2000) {
      throw new Error("Invalid or excessive Last.fm page count");
    }
    const pages = [first];
    for (let page = 2; page <= totalPages; page += 5) {
      pages.push(
        ...(await Promise.all(
          Array.from({ length: Math.min(5, totalPages - page + 1) }, (_, i) =>
            fetchPage(page + i),
          ),
        )),
      );
    }
    const days = new Map<string, DailyActivity>();
    for (const page of pages) {
      const tracks = Array.isArray(page.track) ? page.track : [page.track];
      for (const track of tracks) {
        if (!track.date) continue;
        const timestamp = Number(track.date.uts);
        if (
          !Number.isFinite(timestamp) ||
          timestamp < start ||
          timestamp >= end
        )
          continue;
        const date = new Date(timestamp * 1000);
        const key = date.toISOString().slice(0, 10);
        const day = days.get(key) ?? { date: key, count: 0, tracks: [] };
        day.count++;
        day.tracks.push({
          name: track.name,
          artist:
            track.artist["#text"] || track.artist.name || "Unknown Artist",
          url: track.url,
          playedAt: date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "UTC",
          }),
        });
        days.set(key, day);
      }
    }
    return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error("Failed to fetch Last.fm history:", error);
    throw new Error("Listening history is unavailable. Please try again.");
  }
}

export async function getLastFmHistory() {
  const year = new Date().getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(Date.UTC(year, 11, 31));
  end.setUTCDate(end.getUTCDate() + 7 - end.getUTCDay());
  const activities = await fetchRange(
    start.getTime() / 1000,
    end.getTime() / 1000,
  );
  return {
    year,
    activities: activities.map(({ date, count }) => ({ date, count })),
  };
}

export async function getLastFmDay(date: string): Promise<DailyActivity> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  const start = Date.parse(`${date}T00:00:00Z`) / 1000;
  const year = new Date().getUTCFullYear();
  if (
    !Number.isFinite(start) ||
    new Date(start * 1000).toISOString().slice(0, 10) !== date ||
    start < Date.UTC(year - 1, 11, 25) / 1000 ||
    start >= Date.UTC(year + 1, 0, 7) / 1000
  ) {
    throw new Error("Date is outside the displayed history");
  }
  const days = await fetchRange(start, start + 86400);
  return days[0] ?? { date, count: 0, tracks: [] };
}
