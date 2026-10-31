import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bucketScrobbles } from "./activity.ts";
import { dayKey, shiftDayKey } from "./time.ts";

const at = (iso: string) => Date.parse(iso) / 1000;

describe("dayKey", () => {
  it("uses the requested zone, not the machine's", () => {
    const ms = Date.parse("2026-03-01T23:30:00Z");
    assert.equal(dayKey(ms, "UTC"), "2026-03-01");
    assert.equal(dayKey(ms, "Africa/Lagos"), "2026-03-02");
    assert.equal(dayKey(ms), "2026-03-02");
  });

  it("shifts keys by calendar days across month ends", () => {
    assert.equal(shiftDayKey("2026-03-01", -1), "2026-02-28");
    assert.equal(shiftDayKey("2026-12-31", 1), "2027-01-01");
  });
});

describe("bucketScrobbles", () => {
  it("buckets by Lagos day so late-evening UTC plays land on the next day", () => {
    const days = bucketScrobbles([
      { uts: at("2026-03-01T22:59:00Z"), artist: "A" },
      { uts: at("2026-03-01T23:00:00Z"), artist: "A" },
    ]);
    assert.deepEqual(days, [
      { date: "2026-03-01", count: 1, topArtist: "A" },
      { date: "2026-03-02", count: 1, topArtist: "A" },
    ]);
  });

  it("counts plays, picks the top artist and sorts oldest first", () => {
    const days = bucketScrobbles([
      { uts: at("2026-03-05T10:00:00Z"), artist: "B" },
      { uts: at("2026-03-02T10:00:00Z"), artist: "A" },
      { uts: at("2026-03-05T11:00:00Z"), artist: "C" },
      { uts: at("2026-03-05T12:00:00Z"), artist: "C" },
    ]);
    assert.deepEqual(days, [
      { date: "2026-03-02", count: 1, topArtist: "A" },
      { date: "2026-03-05", count: 3, topArtist: "C" },
    ]);
  });

  it("drops days before minDate", () => {
    const days = bucketScrobbles(
      [
        { uts: at("2026-03-01T10:00:00Z"), artist: "A" },
        { uts: at("2026-03-03T10:00:00Z"), artist: "A" },
      ],
      { minDate: "2026-03-02" },
    );
    assert.deepEqual(
      days.map((d) => d.date),
      ["2026-03-03"],
    );
  });
});
