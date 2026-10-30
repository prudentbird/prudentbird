"use server";

import { cacheLife } from "next/cache";
import { env } from "~/env";
import { getSpotifyTrack } from "~/app/actions/spotify";

/**
 * Finds the YouTube upload that best matches the track Spotify currently
 * reports. Server actions are reachable by direct POST, so this takes no
 * arguments and reads the track server-side: callers can't search for anything
 * else. Search costs 100 of 10,000 daily quota units, so matches are cached per
 * track. Returns the track's Spotify URL so callers can discard a result for a
 * track that has since changed.
 */
export async function findYouTubeMatch(): Promise<{
  url: string;
  id: string | null;
} | null> {
  const track = await getSpotifyTrack();
  if (!track) return null;
  const title = track.name.replace(/\s*[([].*?[)\]]/g, "").trim();
  const artist = track.artist.split(",")[0]!.trim();
  try {
    const id = await match(title, artist, Math.round(track.duration / 1000));
    return { url: track.url, id };
  } catch {
    return null;
  }
}

async function match(
  title: string,
  artist: string,
  seconds: number,
): Promise<string | null> {
  "use cache";
  cacheLife("weeks");
  const key = env.YOUTUBE_API_KEY;
  const search = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "10",
    videoEmbeddable: "true",
    safeSearch: "none",
    q: `${artist} ${title}`,
    key,
  });
  type SearchResult = {
    items?: {
      id: { videoId: string };
      snippet: { title: string; channelTitle: string };
    }[];
  };
  const searchVideos = async () => {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${search}`,
    );
    if (!response.ok) throw new Error("YouTube search failed");
    return ((await response.json()) as SearchResult).items ?? [];
  };
  let items = await searchVideos();
  if (!items.length && title.length > 4) {
    const prefix = title.slice(0, Math.max(3, Math.ceil(title.length / 2)));
    search.set("q", `${artist} ${prefix}`);
    items = await searchVideos();
  }
  if (!items.length) return null;

  const ids = items.map((i) => i.id.videoId).join(",");
  const detailsResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${key}`,
  );
  if (!detailsResponse.ok) throw new Error("YouTube video lookup failed");
  const details = (await detailsResponse.json()) as {
    items?: { id: string; contentDetails: { duration: string } }[];
  };
  const length = new Map(
    (details.items ?? []).map((v) => {
      const [, h = "0", m = "0", s = "0"] =
        v.contentDetails.duration.match(
          /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/,
        ) ?? [];
      return [v.id, +h * 3600 + +m * 60 + +s];
    }),
  );

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const scored = items
    .filter((i) => norm(i.snippet.title).includes(norm(title)))
    .map((i) => {
      const diff = Math.abs((length.get(i.id.videoId) ?? 0) - seconds);
      const official =
        /- topic$|vevo$/i.test(i.snippet.channelTitle) ||
        norm(i.snippet.channelTitle).includes(norm(artist));
      const lyrics = /lyric/i.test(i.snippet.title);
      return {
        id: i.id.videoId,
        score: diff + (official ? 0 : 4) + (lyrics ? 3 : 0),
        diff,
      };
    })
    .sort((a, b) => a.score - b.score);
  return scored.find((s) => s.diff <= 8)?.id ?? null;
}
