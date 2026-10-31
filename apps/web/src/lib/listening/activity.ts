import { dayKey, LISTENING_TIME_ZONE } from "./time.ts";

export type Scrobble = { uts: number; artist: string };

export type DayActivity = {
  date: string;
  count: number;
  topArtist: string | null;
};

/**
 * Collapses scrobbles into one entry per day in `timeZone`, oldest first. The
 * client only draws a count and the top artist per day, so that is all we send.
 * Days before `minDate` are dropped (the fetch window starts mid-day).
 */
export function bucketScrobbles(
  scrobbles: Scrobble[],
  {
    minDate,
    timeZone = LISTENING_TIME_ZONE,
  }: { minDate?: string; timeZone?: string } = {},
): DayActivity[] {
  const days = new Map<string, Map<string, number>>();
  for (const { uts, artist } of scrobbles) {
    const date = dayKey(uts * 1000, timeZone);
    if (minDate && date < minDate) continue;
    const artists = days.get(date) ?? new Map<string, number>();
    artists.set(artist, (artists.get(artist) ?? 0) + 1);
    days.set(date, artists);
  }
  return [...days]
    .map(([date, artists]) => {
      let topArtist: string | null = null;
      let top = 0;
      let count = 0;
      for (const [artist, plays] of artists) {
        count += plays;
        if (plays > top) [topArtist, top] = [artist, plays];
      }
      return { date, count, topArtist };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
