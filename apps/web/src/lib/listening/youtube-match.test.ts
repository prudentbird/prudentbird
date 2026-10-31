import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  choose,
  containsPhrase,
  normalize,
  parseDuration,
  searchTitle,
  shortlist,
  splitArtists,
  type Candidate,
  type Wanted,
} from "./youtube-match.ts";

const wanted: Wanted = {
  title: "Blinding Lights",
  artists: ["The Weeknd"],
  seconds: 200,
};
const video = (
  id: string,
  title: string,
  channel = "The Weeknd",
): Candidate => ({
  id,
  title,
  channel,
});
const pick = (w: Wanted, items: Candidate[], lengths: Record<string, number>) =>
  choose(w, shortlist(w, items), new Map(Object.entries(lengths)));

describe("normalize", () => {
  it("keeps letters and digits from every script", () => {
    assert.equal(normalize("夜に駆ける"), "夜に駆ける");
    assert.equal(normalize("Beyoncé – Halo!"), "beyoncé halo");
    assert.equal(normalize("Don't Stop"), normalize("Dont Stop"));
  });

  it("is empty for punctuation-only input", () => {
    assert.equal(normalize("!!! ???"), "");
  });
});

describe("containsPhrase", () => {
  it("matches whole words only", () => {
    assert.equal(containsPhrase("Supreme (Official Video)", "Up"), false);
    assert.equal(containsPhrase("Up (Official Video)", "Up"), true);
  });

  it("matches unspaced scripts by substring", () => {
    assert.equal(
      containsPhrase("YOASOBI「夜に駆ける」Official", "夜に駆ける"),
      true,
    );
  });

  it("never matches an empty phrase", () => {
    assert.equal(containsPhrase("anything", ""), false);
    assert.equal(containsPhrase("anything", "?!"), false);
  });
});

describe("searchTitle", () => {
  it("drops bracketed extras and remaster suffixes", () => {
    assert.equal(searchTitle("Hello (feat. X) [Live]"), "Hello");
    assert.equal(searchTitle("Heroes - 2017 Remaster"), "Heroes");
  });

  it("keeps the full name when stripping would leave nothing", () => {
    assert.equal(searchTitle("(Intro)"), "(Intro)");
  });
});

describe("splitArtists", () => {
  it("splits Spotify's joined artist string", () => {
    assert.deepEqual(splitArtists("A, B"), ["A", "B"]);
  });
});

describe("parseDuration", () => {
  it("parses ISO 8601 durations", () => {
    assert.equal(parseDuration("PT3M20S"), 200);
    assert.equal(parseDuration("PT1H1M1S"), 3661);
    assert.ok(Number.isNaN(parseDuration("P0D")));
    assert.ok(Number.isNaN(parseDuration("PT")));
    assert.equal(parseDuration("PT0S"), 0);
  });
});

describe("shortlist", () => {
  it("rejects every video when the title normalizes to nothing", () => {
    const empty = { ...wanted, title: "?!" };
    assert.deepEqual(shortlist(empty, [video("a", "anything at all")]), []);
  });

  it("requires the artist in the title or channel", () => {
    const items = [
      video("a", "Blinding Lights (cover)", "Some Kid"),
      video("b", "Blinding Lights - The Weeknd", "Random Uploads"),
      video("c", "Blinding Lights", "The Weeknd"),
    ];
    assert.deepEqual(
      shortlist(wanted, items).map((i) => i.id),
      ["b", "c"],
    );
  });

  it("accepts any listed artist", () => {
    const w = { ...wanted, artists: ["Nobody", "The Weeknd"] };
    assert.equal(shortlist(w, [video("a", "Blinding Lights")]).length, 1);
  });
});

describe("choose", () => {
  it("prefers the official upload within the length tolerance", () => {
    const items = [
      video("fan", "Blinding Lights - The Weeknd", "Fan Channel"),
      video("official", "Blinding Lights", "The Weeknd - Topic"),
    ];
    // The fan upload is closer in length but not official.
    assert.equal(pick(wanted, items, { fan: 199, official: 203 }), "official");
  });

  it("rejects videos whose length is far off or unknown", () => {
    const items = [
      video("a", "Blinding Lights"),
      video("b", "Blinding Lights"),
    ];
    assert.equal(pick(wanted, items, { a: 260 }), null);
  });

  it("penalises covers and lyric videos that the track isn't", () => {
    const items = [
      video("cover", "Blinding Lights (Cover)"),
      video("lyrics", "Blinding Lights (Lyric Video)"),
      video("plain", "Blinding Lights"),
    ];
    assert.equal(
      pick(wanted, items, { cover: 200, lyrics: 200, plain: 201 }),
      "plain",
    );
  });

  it("refuses to match when the track has no known length", () => {
    assert.equal(
      pick({ ...wanted, seconds: 0 }, [video("a", "Blinding Lights")], {
        a: 0,
      }),
      null,
    );
  });
});
