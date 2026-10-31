/** Listening days are bucketed (server) and charted (client) in this zone. */
export const LISTENING_TIME_ZONE = "Africa/Lagos";

const formatters = new Map<string, Intl.DateTimeFormat>();

/** `YYYY-MM-DD` for the instant `ms`, as seen in `timeZone`. */
export function dayKey(ms: number, timeZone = LISTENING_TIME_ZONE) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(ms).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Moves a `YYYY-MM-DD` key by whole calendar days. */
export function shiftDayKey(key: string, days: number) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
