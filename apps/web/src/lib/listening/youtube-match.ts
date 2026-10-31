export type Wanted = {
  /** Cleaned song title, e.g. "Blinding Lights". */
  title: string;
  artists: string[];
  seconds: number;
};

export type Candidate = {
  id: string;
  title: string;
  channel: string;
};

/** How far a video's length may drift from Spotify's before we call it wrong. */
const MAX_DURATION_DRIFT = 8;
const UNWANTED =
  /\b(cover|karaoke|remix|reaction|slowed|sped up|nightcore|8d|instrumental|tribute|live)\b/i;
// Scripts written without spaces, where token matching can't work.
const UNSPACED =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;

/**
 * Lowercased words separated by single spaces. Keeps letters and digits of any
 * script (so "夜に駆ける" survives) and drops apostrophes so "Don't" == "Dont".
 */
export function normalize(s: string) {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** True when `phrase` appears in `text` as whole words. Empty phrases never match. */
export function containsPhrase(text: string, phrase: string) {
  const needle = normalize(phrase);
  if (!needle) return false;
  const haystack = normalize(text);
  if (UNSPACED.test(needle)) return haystack.includes(needle);
  return ` ${haystack} `.includes(` ${needle} `);
}

/**
 * The title worth searching for: Spotify's name without bracketed extras
 * ("(feat. X)", "[Remastered]") or a trailing "- Remastered 2011" style suffix.
 * Falls back to the full name if stripping would leave nothing.
 */
export function searchTitle(name: string) {
  const cleaned = name
    .replace(/\s*[([].*?[)\]]/g, "")
    .replace(
      /\s+-\s+.*\b(remaster(ed)?|version|edit|mix|mono|stereo|live|deluxe|single)\b.*$/i,
      "",
    )
    .trim();
  return normalize(cleaned) ? cleaned : name.trim();
}

export function splitArtists(artist: string) {
  return artist
    .split(",")
    .map((a) => a.trim())
    .filter((a) => normalize(a));
}

/** "PT3M20S" -> 200. Unparseable input gives NaN so it can never pass a length check. */
export function parseDuration(iso: string) {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return NaN;
  const [, h = "0", min = "0", s = "0"] = m;
  return +h * 3600 + +min * 60 + +s;
}

const sameArtist = (wanted: Wanted, candidate: Candidate) =>
  wanted.artists.some(
    (artist) =>
      containsPhrase(candidate.channel, artist) ||
      containsPhrase(candidate.title, artist),
  );

/**
 * Candidates plausible enough to spend a duration lookup on: the title must
 * contain the song's title as whole words, and the video or its channel must
 * mention one of the artists (when we know any).
 */
export function shortlist(wanted: Wanted, items: Candidate[]) {
  if (!normalize(wanted.title)) return [];
  return items.filter(
    (item) =>
      containsPhrase(item.title, wanted.title) &&
      (!wanted.artists.length || sameArtist(wanted, item)),
  );
}

/** Best shortlisted candidate by length and "officialness", or null. */
export function choose(
  wanted: Wanted,
  items: Candidate[],
  lengths: Map<string, number>,
) {
  if (!wanted.seconds) return null;
  let best: { id: string; score: number } | null = null;
  for (const item of items) {
    const drift = Math.abs((lengths.get(item.id) ?? NaN) - wanted.seconds);
    if (!(drift <= MAX_DURATION_DRIFT)) continue;
    const official =
      /- topic$|vevo$/i.test(item.channel) ||
      wanted.artists.some((artist) => containsPhrase(item.channel, artist));
    const score =
      drift +
      (official ? 0 : 4) +
      (/lyric/i.test(item.title) ? 3 : 0) +
      (UNWANTED.test(item.title) && !UNWANTED.test(wanted.title) ? 6 : 0);
    if (!best || score < best.score) best = { id: item.id, score };
  }
  return best?.id ?? null;
}
