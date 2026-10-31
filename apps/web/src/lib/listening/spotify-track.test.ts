import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toSpotifyTrack } from "./spotify-track.ts";

const state = { isPlaying: true, progress: 1234 };
const item = {
  type: "track",
  name: "Song",
  duration_ms: 200_000,
  external_urls: { spotify: "https://open.spotify.com/track/1" },
  artists: [{ name: "A" }, { name: "B" }],
  album: {
    images: [
      { url: "small", width: 64 },
      { url: "large", width: 640 },
      { url: "medium", width: 300 },
    ],
  },
};

describe("toSpotifyTrack", () => {
  it("maps a track", () => {
    assert.deepEqual(toSpotifyTrack(item, state), {
      name: "Song",
      artist: "A, B",
      url: "https://open.spotify.com/track/1",
      images: { small: "small", medium: "medium" },
      duration: 200_000,
      progress: 1234,
      isPlaying: true,
    });
  });

  it("returns null for a missing item (ads, private sessions)", () => {
    assert.equal(toSpotifyTrack(null, state), null);
    assert.equal(toSpotifyTrack(undefined, state), null);
  });

  it("returns null for podcast episodes", () => {
    assert.equal(toSpotifyTrack({ ...item, type: "episode" }, state), null);
  });
});
