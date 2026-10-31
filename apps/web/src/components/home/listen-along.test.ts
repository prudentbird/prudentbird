import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  ListenAlong,
  type ListenAlongDeps,
  type ListenStatus,
  type PlayerLike,
} from "./listen-along.ts";

const PLAYING = 1;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

class FakePlayer implements PlayerLike {
  destroyed = false;
  state = -1;
  loaded: Array<{ videoId: string; startSeconds?: number }> = [];
  videoId: string;
  startSeconds: number;
  events: { onReady: () => void; onError: () => void };
  constructor(
    videoId: string,
    startSeconds: number,
    events: { onReady: () => void; onError: () => void },
  ) {
    this.videoId = videoId;
    this.startSeconds = startSeconds;
    this.events = events;
  }
  playVideo() {
    this.state = PLAYING;
  }
  pauseVideo() {
    this.state = 2;
  }
  seekTo() {}
  loadVideoById(o: { videoId: string; startSeconds?: number }) {
    this.loaded.push(o);
  }
  getCurrentTime() {
    return 12;
  }
  getDuration() {
    return 200;
  }
  getPlayerState() {
    return this.state;
  }
  destroy() {
    this.destroyed = true;
  }
}

type Match = { url: string; id: string | null } | null;

let matches: Map<string, ReturnType<typeof deferred<Match>>>;
let players: FakePlayer[];
let statuses: ListenStatus[];
let clears: number;
let seconds: number;
let apiLoad: () => Promise<void>;
let lastTrack: string;

const track = (id: string) => ({ url: `spotify:${id}` });
const answer = (id: string, video: string | null) =>
  matches.get(id)!.resolve({ url: `spotify:${id}`, id: video });

function make() {
  const deps: ListenAlongDeps = {
    // Mirrors the server action: it answers for whatever is playing *now*.
    match: () => {
      const d = deferred<Match>();
      matches.set(lastTrack, d);
      return d.promise;
    },
    loadApi: () => apiLoad(),
    startSeconds: () => seconds,
    createPlayer: (videoId, startSeconds, events) => {
      const player = new FakePlayer(videoId, startSeconds, events);
      players.push(player);
      return player;
    },
    clearHost: () => void clears++,
    onStatus: (status) => void statuses.push(status),
    playingState: PLAYING,
  };
  return new ListenAlong(deps);
}

beforeEach(() => {
  matches = new Map();
  players = [];
  statuses = [];
  clears = 0;
  seconds = 0;
  apiLoad = () => Promise.resolve();
  lastTrack = "";
});

const request = (
  la: ListenAlong,
  id: string,
  how: "start" | "follow" = "start",
) => {
  lastTrack = id;
  return la[how](track(id));
};

describe("ListenAlong", () => {
  it("creates a player and goes live once it is ready", async () => {
    const la = make();
    const run = request(la, "a");
    answer("a", "vidA");
    await run;
    assert.equal(la.status, "loading");
    players[0]!.events.onReady();
    assert.equal(la.status, "on");
    assert.equal(players[0]!.state, PLAYING);
  });

  it("reads the Spotify position after the lookup, not before", async () => {
    const la = make();
    seconds = 10;
    const run = request(la, "a");
    seconds = 42; // time passed while YouTube was being searched
    answer("a", "vidA");
    await run;
    assert.equal(players[0]!.startSeconds, 42);
  });

  it("reuses a ready player and marks it live without waiting for onReady", async () => {
    const la = make();
    let run = request(la, "a");
    answer("a", "vidA");
    await run;
    players[0]!.events.onReady();

    seconds = 30;
    run = request(la, "b", "follow")!;
    assert.equal(la.status, "loading");
    assert.equal(
      players[0]!.state,
      2,
      "old song is paused while the next loads",
    );
    answer("b", "vidB");
    await run;
    assert.deepEqual(players[0]!.loaded, [
      { videoId: "vidB", startSeconds: 30 },
    ]);
    assert.equal(la.status, "on");
    assert.equal(players.length, 1);
  });

  it("stops and clears the old player when the next song has no match", async () => {
    const la = make();
    let run = request(la, "a");
    answer("a", "vidA");
    await run;
    players[0]!.events.onReady();

    run = request(la, "b", "follow")!;
    answer("b", null);
    await run;
    assert.equal(la.status, "missing");
    assert.equal(players[0]!.destroyed, true);
    assert.equal(la.playback(), null);
  });

  it("recovers from a failed match: retrying builds a fresh player and leaves loading", async () => {
    const la = make();
    let run = request(la, "a");
    answer("a", null);
    await run;
    assert.equal(la.status, "missing");

    run = request(la, "a");
    assert.equal(la.status, "loading");
    answer("a", "vidA");
    await run;
    players[0]!.events.onReady();
    assert.equal(la.status, "on");
  });

  it("recovers after a player error, destroying the broken player", async () => {
    const la = make();
    let run = request(la, "a");
    answer("a", "vidA");
    await run;
    players[0]!.events.onError();
    assert.equal(la.status, "missing");
    assert.equal(players[0]!.destroyed, true);

    run = request(la, "a");
    answer("a", "vidA");
    await run;
    assert.equal(players.length, 2);
    players[1]!.events.onReady();
    assert.equal(la.status, "on");
  });

  it("goes missing when the YouTube API cannot load", async () => {
    const la = make();
    apiLoad = () => Promise.reject(new Error("blocked"));
    const run = request(la, "a");
    answer("a", "vidA");
    await run;
    assert.equal(la.status, "missing");
    assert.equal(players.length, 0);
  });

  it("goes missing when the match lookup throws", async () => {
    const la = make();
    const run = request(la, "a");
    matches.get("a")!.reject(new Error("quota"));
    await run;
    assert.equal(la.status, "missing");
  });

  it("drops an older lookup that resolves after a newer request", async () => {
    const la = make();
    const first = request(la, "a");
    const secondRun = request(la, "b", "start");
    answer("b", "vidB");
    await secondRun;
    answer("a", "vidA"); // slow, out-of-order reply
    await first;
    assert.equal(players.length, 1);
    assert.equal(players[0]!.videoId, "vidB");
  });

  it("replaces a player that is still booting when a newer request arrives", async () => {
    const la = make();
    let run = request(la, "a");
    answer("a", "vidA");
    await run;
    const booting = players[0]!;

    run = request(la, "b", "start");
    answer("b", "vidB");
    await run;
    assert.equal(booting.destroyed, true);
    assert.equal(players.length, 2);

    booting.events.onReady(); // late event from the superseded player
    assert.equal(la.status, "loading");
    players[1]!.events.onReady();
    assert.equal(la.status, "on");
  });

  it("creates no player when disposed (navigated away) while the lookup is pending", async () => {
    const la = make();
    const run = request(la, "a");
    la.dispose();
    answer("a", "vidA");
    await run;
    assert.equal(players.length, 0);
    assert.deepEqual(statuses, ["loading"]);
  });

  it("creates no player when disposed while the API is loading", async () => {
    const la = make();
    const api = deferred<void>();
    apiLoad = () => api.promise;
    const run = request(la, "a");
    answer("a", "vidA");
    await tick();
    la.dispose();
    api.resolve();
    await run;
    assert.equal(players.length, 0);
  });

  it("ignores events from a booting player after dispose", async () => {
    const la = make();
    const run = request(la, "a");
    answer("a", "vidA");
    await run;
    la.dispose();
    players[0]!.events.onReady();
    assert.equal(players[0]!.destroyed, true);
    assert.equal(la.status, "loading");
  });

  it("stop invalidates a pending request", async () => {
    const la = make();
    const run = request(la, "a");
    la.stop();
    answer("a", "vidA");
    await run;
    assert.equal(la.status, "off");
    assert.equal(players.length, 0);
  });

  it("only follows Spotify while listening along, and not for the same song", async () => {
    const la = make();
    assert.equal(request(la, "a", "follow"), undefined);
    assert.equal(la.status, "off");

    const run = request(la, "a");
    answer("a", "vidA");
    await run;
    assert.equal(request(la, "a", "follow"), undefined);

    la.stop();
    assert.equal(request(la, "b", "follow"), undefined);
  });

  it("keeps following after a song with no match", async () => {
    const la = make();
    let run = request(la, "a");
    answer("a", null);
    await run;
    run = request(la, "b", "follow")!;
    answer("b", "vidB");
    await run;
    players[0]!.events.onReady();
    assert.equal(la.status, "on");
  });

  it("reports playback only for a ready player", async () => {
    const la = make();
    const run = request(la, "a");
    answer("a", "vidA");
    await run;
    assert.equal(la.playback(), null);
    players[0]!.events.onReady();
    assert.deepEqual(la.playback(), {
      position: 12_000,
      duration: 200_000,
      isPaused: false,
    });
    la.togglePause();
    assert.equal(la.playback()!.isPaused, true);
  });
});
