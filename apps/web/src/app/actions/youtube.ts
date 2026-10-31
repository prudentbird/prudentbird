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
  if (!seconds || !normalize(title)) return { url: track.url, id: null };

  try {
    const id = await match(track.url, title, artists, seconds);
    return { url: track.url, id };
  } catch (error) {
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
  trackUrl: string,
  title: string,
  artists: string[],
  seconds: number,
): Promise<string | null> {
  "use cache";
  const key = env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  const id = await findVideo({ title, artists, seconds }, key);
  if (id) cacheLife("weeks");
  else cacheLife("days");
  return id;
}
