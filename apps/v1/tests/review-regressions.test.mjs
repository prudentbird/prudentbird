import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as nodeModule from "node:module";
import { test } from "node:test";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import { z } from "zod/v4";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// The app supports Node 20.9+, but these tests strip types with a Node 22.13+ API.
if (typeof nodeModule.stripTypeScriptTypes !== "function") {
  throw new Error(
    `pnpm test requires Node 22.13 or newer (running ${process.version})`,
  );
}
const { stripTypeScriptTypes } = nodeModule;

// Run the actual actions with isolated module state and mocked external services.
async function load(
  path,
  fetch = () => assert.fail("Unexpected network request"),
) {
  const errors = [];
  const context = createContext({
    Date,
    Map,
    Buffer,
    URLSearchParams,
    AbortSignal,
    fetch,
    console: { error: (...args) => errors.push(args) },
  });
  const source = await readFile(
    new URL(`../src/${path}`, import.meta.url),
    "utf8",
  );
  const sourceModule = new SourceTextModule(stripTypeScriptTypes(source), {
    context,
  });
  const imports = {
    "zod/v4": { z },
    "~/env": {
      env: {
        LASTFM_USERNAME: "listener",
        LASTFM_API_KEY: "test",
        SPOTIFY_CLIENT_ID: "test",
        SPOTIFY_CLIENT_SECRET: "test",
        SPOTIFY_REFRESH_TOKEN: "test",
      },
    },
    "next/server": { connection: async () => {} },
    "next/cache": { revalidateTag: () => {} },
    clsx: { clsx },
    "tailwind-merge": { twMerge },
  };
  await sourceModule.link((specifier) => {
    const values = imports[specifier];
    assert.ok(values, `Unexpected dependency ${specifier}`);
    return new SyntheticModule(
      Object.keys(values),
      function () {
        for (const [key, value] of Object.entries(values))
          this.setExport(key, value);
      },
      { context },
    );
  });
  await sourceModule.evaluate();
  return { api: sourceModule.namespace, errors };
}
const json = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const year = new Date().getUTCFullYear();
const day = `${year}-06-15`;
const start = Date.parse(`${day}T00:00:00Z`) / 1000;
const track = (uts, name = "Song") => ({
  name,
  artist: { "#text": "Artist" },
  url: "https://last.fm/track",
  ...(uts === null ? {} : { date: { uts: String(uts) } }),
});
const page = (tracks, totalPages = 1) => ({
  recenttracks: { track: tracks, "@attr": { totalPages: String(totalPages) } },
});

test("relative time handles subsecond and 360–364 day boundaries", async () => {
  const { api } = await load("lib/utils.ts");
  assert.equal(api.formatTimeAgo(Date.now()), "just now");
  assert.equal(api.formatTimeAgo(Date.now() - 360 * 86400000), "1 year ago");
  assert.equal(api.formatTimeAgo(Date.now() - 364 * 86400000), "1 year ago");
  assert.equal(
    api.formatTimeAgo(Date.now() - 2 * 365 * 86400000),
    "2 years ago",
  );
});

test("calendar includes December 31 in leap years starting Saturday", async () => {
  const { api } = await load("lib/calendar.ts");
  assert.equal(api.weeksInYear(2000), 54);
  assert.equal(api.weeksInYear(2028), 54);
  assert.equal(api.weeksInYear(2026), 53);
  for (let y = 2000; y < 2100; y++) {
    const first = new Date(Date.UTC(y, 0, 1));
    first.setUTCDate(1 - first.getUTCDay());
    const last = new Date(first);
    last.setUTCDate(last.getUTCDate() + api.weeksInYear(y) * 7 - 1);
    assert.ok(last.getTime() >= Date.UTC(y, 11, 31));
    assert.ok(last.getTime() < Date.UTC(y + 1, 0, 7));
  }
});

test("history summary requests only the graph range and sends no tracks", async () => {
  const urls = [];
  const { api } = await load("app/actions/lastfm.ts", async (url) => {
    urls.push(new URL(url));
    return json(page([track(start)]));
  });
  const result = await api.getLastFmHistory();
  assert.equal(result.year, year);
  assert.equal(result.activities[0].count, 1);
  assert.equal("tracks" in result.activities[0], false);
  const from = Number(urls[0].searchParams.get("from"));
  const to = Number(urls[0].searchParams.get("to"));
  assert.ok(from >= Date.UTC(year - 1, 11, 25) / 1000 - 1);
  assert.ok(to <= Date.UTC(year + 1, 0, 7) / 1000);
});

test("day lookup includes midnight and 23:59:59, ignores now-playing and other days", async () => {
  const { api } = await load("app/actions/lastfm.ts", async (url) => {
    const params = new URL(url).searchParams;
    assert.equal(Number(params.get("from")), start - 1);
    assert.equal(Number(params.get("to")), start + 86400);
    return json(
      page([
        track(start - 1),
        track(start),
        track(start + 86399),
        track(start + 86400),
        track(null),
      ]),
    );
  });
  const result = await api.getLastFmDay(day);
  assert.equal(result.date, day);
  assert.equal(result.count, 2);
  assert.equal(result.tracks[0].playedAt, "00:00");
  assert.equal(result.tracks[1].playedAt, "23:59");
  await assert.rejects(api.getLastFmDay(`${year}-02-30`), /outside/);
  await assert.rejects(api.getLastFmDay("2000-01-01"), /outside/);
});

test("empty Last.fm history is distinct from HTTP, API, network, and malformed page failures", async () => {
  const empty = await load("app/actions/lastfm.ts", async () =>
    json(page([], 0)),
  );
  assert.equal((await empty.api.getLastFmHistory()).activities.length, 0);
  for (const failure of [
    async () => json({}, 503),
    async () => json({ error: 10, message: "Invalid API key" }),
    async () => {
      throw new Error("Network failure");
    },
    async () => ({
      ok: true,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    }),
  ]) {
    const { api, errors } = await load("app/actions/lastfm.ts", async (url) => {
      if (new URL(url).searchParams.get("page") === "1")
        return json(page([track(start)], 2));
      return failure();
    });
    await assert.rejects(api.getLastFmHistory(), /unavailable/);
    assert.equal(errors.length, 1);
  }
});

const searchTrack = (name, artist) => ({
  name,
  artist,
  url: "https://last.fm/track",
  playedAt: "12:00",
});
test("Spotify bounds lookups, preserves result order and length, and separates delimiter collisions", async () => {
  let tokens = 0;
  const queries = [];
  const { api } = await load("app/actions/spotify.ts", async (url) => {
    if (url.includes("/api/token")) {
      tokens++;
      return json({ access_token: "token", expires_in: 3600 });
    }
    const q = new URL(url).searchParams.get("q");
    assert.match(q, /^track:".*" artist:".*"$/);
    queries.push(q);
    return json({
      tracks: {
        items: [
          {
            album: { images: [] },
            artists: [{ name: "Artist" }],
            external_urls: { spotify: `https://spotify.com/${queries.length}` },
          },
        ],
      },
    });
  });
  const inputs = [
    searchTrack("a|||b", "c"),
    searchTrack("a", "b|||c"),
    ...Array.from({ length: 58 }, (_, i) => searchTrack(`Song ${i}`, "Artist")),
  ];
  const results = await api.searchSpotifyTracks(inputs);
  assert.equal(queries.length, 50);
  assert.equal(results.length, 60);
  assert.notEqual(results[0].spotifyUrl, results[1].spotifyUrl);
  assert.equal(results[50].spotifyUrl, null);
  assert.equal(results[59].name, "Song 57");
  await api.searchSpotifyTracks([inputs[0]]);
  assert.equal(tokens, 1);
});

test("Spotify shares an in-flight token refresh and logs upstream errors", async () => {
  let tokens = 0;
  const { api, errors } = await load("app/actions/spotify.ts", async (url) => {
    if (url.includes("/api/token")) {
      tokens++;
      await Promise.resolve();
      return json({ access_token: "token", expires_in: 3600 });
    }
    return json({}, 429);
  });
  const results = await Promise.all([
    api.searchSpotifyTracks([searchTrack("A", "B")]),
    api.searchSpotifyTracks([searchTrack("C", "D")]),
  ]);
  assert.equal(tokens, 1);
  assert.equal(results[0][0].spotifyUrl, null);
  assert.equal(errors.length, 2);
});
