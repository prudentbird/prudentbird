"use server";

import { env } from "~/env";
import { connection } from "next/server";
import {
  toSpotifyTrack,
  type SpotifyTrack,
} from "~/lib/listening/spotify-track";

export type { SpotifyTrack };

const API = "https://api.spotify.com/v1/me/player";
/** Visitors share one lookup per window so polling can't multiply upstream calls. */
const SHARE_MS = 5_000;
const DEFAULT_BACKOFF_S = 30;

let token: { value: string; expiresAt: number } | null = null;
let blockedUntil = 0;
let latest: { at: number; track: Promise<SpotifyTrack | null> } | null = null;

async function getAccessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;

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
    throw new Error(`Failed to get Spotify access token (${response.status})`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };
  token = {
    value: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000,
  };
  return token.value;
}

/**
 * GETs a Spotify player endpoint. 2xx (including 204 "nothing playing") is
 * returned as-is; anything else is an upstream failure and throws, so callers
 * keep showing the last known track instead of mistaking an outage for silence.
 */
async function spotifyGet(path: string, accessToken: string) {
  const response = await fetch(`${API}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (response.status === 429) {
    const wait = Number(response.headers.get("retry-after"));
    blockedUntil =
      Date.now() +
      (Number.isFinite(wait) && wait > 0 ? wait : DEFAULT_BACKOFF_S) * 1000;
  } else if (response.status === 401) {
    token = null;
  }
  if (!response.ok) {
    throw new Error(`Spotify ${path} failed (${response.status})`);
  }
  return response;
}

async function lookup(): Promise<SpotifyTrack | null> {
  if (Date.now() < blockedUntil) {
    throw new Error("Spotify is rate limiting us; backing off");
  }
  const accessToken = await getAccessToken();

  const current = await spotifyGet("currently-playing", accessToken);
  if (current.status === 200) {
    const data = await current.json();
    const track = toSpotifyTrack(data?.item, {
      isPlaying: Boolean(data?.is_playing),
      progress: data?.progress_ms ?? 0,
    });
    if (track) return track;
  }

  // Nothing playing (204), or something that isn't a music track: show the
  // last song instead.
  const recent = await spotifyGet("recently-played?limit=1", accessToken);
  const data = await recent.json();
  return toSpotifyTrack(data?.items?.[0]?.track, {
    isPlaying: false,
    progress: 0,
  });
}

/**
 * The track Spotify is on, the last one played when idle, or null if there is
 * no history. Throws when Spotify itself is unreachable or rate limiting.
 */
export async function getSpotifyTrack(): Promise<SpotifyTrack | null> {
  await connection();
  const now = Date.now();
  if (!latest || now - latest.at >= SHARE_MS) {
    const track = lookup();
    const entry = { at: now, track };
    latest = entry;
    track.catch((error) => {
      console.error(error);
      if (latest === entry) latest = null;
    });
  }
  return latest.track;
}
