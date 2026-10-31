"use server";

import { env } from "~/env";
import { connection } from "next/server";
import { revalidateTag } from "next/cache";

export type SpotifyTrack = {
  url: string;
  name: string;
  artist: string;
  imageUrl: string;
  images: {
    small: string;
    medium: string;
    large: string;
  };
  playedAt?: string;
  duration: number;
  progress: number;
  isPlaying: boolean;
};

let cachedToken: { value: string; expiresAt: number } | undefined;
let tokenRequest: Promise<string> | undefined;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt)
    return cachedToken.value;
  if (tokenRequest) return tokenRequest;
  tokenRequest = refreshAccessToken();
  try {
    return await tokenRequest;
  } finally {
    tokenRequest = undefined;
  }
}

async function refreshAccessToken(): Promise<string> {
  const basic = Buffer.from(
    `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: env.SPOTIFY_REFRESH_TOKEN,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to get Spotify access token");
  }

  const data = await response.json();
  if (
    typeof data.access_token !== "string" ||
    !Number.isFinite(data.expires_in)
  ) {
    throw new Error("Invalid Spotify token response");
  }
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(0, data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

export async function getSpotifyTrack(): Promise<SpotifyTrack | null> {
  await connection();
  try {
    const accessToken = await getAccessToken();

    const response = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        next: { tags: ["spotify-current"] },
      },
    );

    let data;
    let item;
    let fromRecent = false;

    if (response.status === 200) {
      data = await response.json();
      item = data?.item;
    } else {
      const recentlyPlayedResponse = await fetch(
        "https://api.spotify.com/v1/me/player/recently-played?limit=1",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          next: { tags: ["spotify-recently-played"] },
        },
      );

      if (recentlyPlayedResponse.status !== 200) {
        return null;
      }

      const recentJson = await recentlyPlayedResponse.json();
      data = recentJson.items?.[0];
      item = data?.track;
      fromRecent = true;
    }

    if (!item) {
      return null;
    }

    const albumImages: Array<{ url: string; width?: number; height?: number }> =
      Array.isArray(item?.album?.images) ? item.album.images : [];

    const sorted = [...albumImages].sort(
      (a, b) => (b.width ?? 0) - (a.width ?? 0),
    );
    const large = sorted[0]?.url ?? "";
    const medium = sorted[1]?.url ?? large;
    const small = sorted[sorted.length - 1]?.url ?? large;

    const artistsArray: Array<{ name: string }> = Array.isArray(item?.artists)
      ? item.artists
      : [];

    const track: SpotifyTrack = {
      name: item.name,
      artist: artistsArray.map((artist) => artist.name).join(", "),
      imageUrl: large,
      images: { small, medium, large },
      url: item?.external_urls?.spotify ?? "",
      isPlaying: fromRecent ? false : Boolean(data?.is_playing),
      playedAt: fromRecent ? data?.played_at : undefined,
      duration: item?.duration_ms ?? 0,
      progress: fromRecent ? 0 : (data?.progress_ms ?? 0),
    };

    return track;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function revalidateSpotifyCurrent() {
  revalidateTag("spotify-current", {});
}

export type SpotifySearchResult = {
  name: string;
  artist: string;
  lastfmUrl: string;
  spotifyUrl: string | null;
  albumImage: string | null;
  playedAt: string;
};

export async function searchSpotifyTracks(
  tracks: Array<{
    name: string;
    artist: string;
    url: string;
    playedAt: string;
  }>,
): Promise<SpotifySearchResult[]> {
  try {
    const token = await getAccessToken();

    const uniqueKeys = new Map<string, { name: string; artist: string }>();
    for (const t of tracks) {
      const key = JSON.stringify([t.name, t.artist]);
      if (uniqueKeys.size < 50 && !uniqueKeys.has(key))
        uniqueKeys.set(key, { name: t.name, artist: t.artist });
    }

    const entries = Array.from(uniqueKeys.entries());
    const results: {
      key: string;
      spotifyUrl: string | null;
      albumImage: string | null;
      artists: string | null;
    }[] = [];
    for (let i = 0; i < entries.length; i += 5) {
      const batch = entries.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map(async ([key, { name, artist }]) => {
          try {
            const q = encodeURIComponent(
              `track:"${name.replaceAll('"', " ")}" artist:"${artist.replaceAll('"', " ")}"`,
            );
            const res = await fetch(
              `https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`,
              {
                headers: { Authorization: `Bearer ${token}` },
                next: { revalidate: 86400 },
              },
            );
            if (!res.ok) {
              console.error("Spotify search failed:", res.status);
              return { key, spotifyUrl: null, albumImage: null, artists: null };
            }
            const data = await res.json();
            const item = data.tracks?.items?.[0];
            if (!item)
              return { key, spotifyUrl: null, albumImage: null, artists: null };

            const images: Array<{ url: string }> = item.album?.images ?? [];
            const albumImage =
              images[images.length - 1]?.url ?? images[0]?.url ?? null;
            const artists = (item.artists as Array<{ name: string }>)
              .map((a) => a.name)
              .join(", ");

            return {
              key,
              spotifyUrl: item.external_urls?.spotify ?? null,
              albumImage,
              artists,
            };
          } catch (error) {
            console.error("Spotify search failed:", error);
            return { key, spotifyUrl: null, albumImage: null, artists: null };
          }
        }),
      );
      results.push(...batchResults);
    }

    const resultMap = new Map(results.map((r) => [r.key, r]));

    return tracks.map((t) => {
      const key = JSON.stringify([t.name, t.artist]);
      const result = resultMap.get(key);
      return {
        name: t.name,
        artist: result?.artists ?? t.artist,
        lastfmUrl: t.url,
        spotifyUrl: result?.spotifyUrl ?? null,
        albumImage: result?.albumImage ?? null,
        playedAt: t.playedAt,
      };
    });
  } catch (error) {
    console.error("Spotify search failed:", error);
    return tracks.map((t) => ({
      name: t.name,
      artist: t.artist,
      lastfmUrl: t.url,
      spotifyUrl: null,
      albumImage: null,
      playedAt: t.playedAt,
    }));
  }
}
