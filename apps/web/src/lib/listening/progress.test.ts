import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimateProgressMs } from "./progress.ts";

const base = { progress: 60_000, duration: 180_000, receivedAt: 1_000 };

describe("estimateProgressMs", () => {
  it("advances while playing", () => {
    assert.equal(
      estimateProgressMs({ ...base, isPlaying: true }, 6_000),
      65_000,
    );
  });

  it("holds still while paused or for a last-played track", () => {
    assert.equal(
      estimateProgressMs({ ...base, isPlaying: false }, 6_000),
      60_000,
    );
  });

  it("never exceeds the duration or runs backwards", () => {
    assert.equal(
      estimateProgressMs({ ...base, isPlaying: true }, 10_000_000),
      180_000,
    );
    assert.equal(estimateProgressMs({ ...base, isPlaying: true }, 0), 60_000);
  });
});
