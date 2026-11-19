import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextPollMs } from "./live.ts";

const snap = (progress: number, isPlaying = true) => ({
  receivedAt: 0,
  track: {
    url: "u",
    name: "n",
    artist: "a",
    images: { small: "", medium: "" },
    duration: 200_000,
    progress,
    isPlaying,
  },
});

describe("nextPollMs", () => {
  it("polls slowly when idle and mid-song", () => {
    assert.equal(nextPollMs(undefined, 0), 30_000);
    assert.equal(nextPollMs(snap(0, false), 0), 30_000);
    assert.equal(nextPollMs(snap(10_000), 0), 15_000);
  });
  it("wakes just after the song should end", () => {
    assert.equal(nextPollMs(snap(195_000), 0), 6_500);
    assert.equal(nextPollMs(snap(190_000), 5_000), 6_500);
  });
  it("polls quickly once the song is overdue", () => {
    assert.equal(nextPollMs(snap(199_000), 5_000), 2_500);
  });
});
