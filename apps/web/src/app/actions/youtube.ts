"use server";

import { cacheLife } from "next/cache";
import { env } from "~/env";
import { getSpotifyTrack } from "~/app/actions/spotify";
import {
  choose,
  normalize,
  parseDuration,
  searchTitle,
  shortlist,
  splitArtists,
  type Candidate,
  type Wanted,
} from "~/lib/listening/youtube-match";

/**
 * Finds the YouTube upload that best matches the track Spotify currently
 * reports. Server actions are reachable by direct POST, so this takes no
 * arguments and reads the track server-side: callers can't search for anything
 * else. Search costs 100 of 10,000 daily quota units, so matches are cached per
 * track. Returns the track's Spotify URL so callers can discard a result for a
 * track that has since changed.
 *
 * Without YOUTUBE_API_KEY matching is switched off: no Spotify or YouTube calls
 * are made and the result is null.
 */
export async function findYouTubeMatch(): Promise<{
  url: string;
  id: string | null;
} | null> {
  if (!env.YOUTUBE_API_KEY) return null;
  let track;
  try {
    track = await getSpotifyTrack();
  } catch {
    return null;
  }
  if (!track) return null;

  const title = searchTitle(track.name);
  const artists = splitArtists(track.artist);
  const seconds = Math.round(track.duration / 1000);
  // Nothing to compare against, so any search would be a guess that gets cached.
  if (!seconds || !normalize(title)) return { url: track.url, id: null };

  try {
    const id = await match(track.url, title, artists, seconds);
    return { url: track.url, id };
  } catch (error) {
    // Transient (quota, network): the cache function threw, so nothing was
    // stored and the next request tries again.
    console.error(error);
    return null;
  }
}

type SearchResult = {
  items?: {
    id: { videoId: string };
    snippet: { title: string; channelTitle: string };
  }[];
};

async function search(query: string, key: string): Promise<Candidate[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "10",
    videoEmbeddable: "true",
    safeSearch: "none",
    q: query,
    key,
  });
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
  );
  if (!response.ok)
    throw new Error(`YouTube search failed (${response.status})`);
  return (((await response.json()) as SearchResult).items ?? []).map(
    (item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
    }),
  );
}

async function lengths(ids: string[], key: string) {
  const params = new URLSearchParams({
    part: "contentDetails",
    id: ids.join(","),
    key,
  });
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params}`,
  );
  if (!response.ok)
    throw new Error(`YouTube video lookup failed (${response.status})`);
  const details = (await response.json()) as {
    items?: { id: string; contentDetails: { duration: string } }[];
  };
  return new Map(
    (details.items ?? []).map((v) => [
      v.id,
      parseDuration(v.contentDetails.duration),
    ]),
  );
}

async function findVideo(wanted: Wanted, key: string) {
  const artist = wanted.artists[0] ?? "";
  const prefix = wanted.title.slice(
    0,
    Math.max(3, Math.ceil(wanted.title.length / 2)),
  );
  // The second query loosens the wording in case the full title is why the
  // first one found nothing usable.
  const queries = [`${artist} ${wanted.title}`];
  if (wanted.title.length > 4) queries.push(`${artist} ${prefix}`);

  for (const query of queries) {
    const usable = shortlist(wanted, await search(query, key));
    if (!usable.length) continue;
    const id = choose(
      wanted,
      usable,
      await lengths(
        usable.map((item) => item.id),
        key,
      ),
    );
    if (id) return id;
  }
  return null;
}

async function match(
  // Keep distinct Spotify recordings in separate cache entries.
  trackUrl: string,
  title: string,
  artists: string[],
  seconds: number,
): Promise<string | null> {
  "use cache";
  const key = env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  // Any failure above throws before this point, so only real answers are
  // cached. Hits are stable; misses expire sooner in case an upload appears.
  const id = await findVideo({ title, artists, seconds }, key);
  if (id) cacheLife("weeks");
  else cacheLife("days");
  return id;
}
