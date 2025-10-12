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
  blurDataURL?: string;
  playedAt?: string;
  duration: number;
  progress: number;
  isPlaying: boolean;
};

async function getAccessToken(): Promise<string> {
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

  return (await response.json()).access_token;
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

    let blurDataURL: string | undefined;
    if (small) {
      try {
        const imgRes = await fetch(small, { cache: "force-cache" });
        if (imgRes.ok) {
          const contentType =
            imgRes.headers.get("content-type") || "image/jpeg";
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          const base64 = buffer.toString("base64");
          blurDataURL = `data:${contentType};base64,${base64}`;
        }
      } catch {}
    }

    const artistsArray: Array<{ name: string }> = Array.isArray(item?.artists)
      ? item.artists
      : [];

    const track: SpotifyTrack = {
      name: item.name,
      artist: artistsArray.map((artist) => artist.name).join(", "),
      imageUrl: large,
      images: { small, medium, large },
      blurDataURL,
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
