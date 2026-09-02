import { authComponent } from "./auth";
import { query } from "./_generated/server";
import { dailyStatsFor } from "./daily";
import { rankOf } from "./ratings";
import { DIFFICULTIES, type Difficulty } from "./lib/sudoku";

type Bucket = {
  played: number;
  won: number;
  perfect: number;
  points: number;
  bestMs: number | null;
  totalMs: number;
  timed: number;
};

function bucket(): Bucket {
  return {
    played: 0,
    won: 0,
    perfect: 0,
    points: 0,
    bestMs: null,
    totalMs: 0,
    timed: 0,
  };
}

function record(
  b: Bucket,
  won: boolean,
  ms: number | null,
  mistakes: number,
  points: number,
) {
  b.played++;
  if (!won) return;
  b.won++;
  b.points += points;
  if (mistakes === 0) b.perfect++;
  if (ms !== null) {
    b.timed++;
    b.totalMs += ms;
    if (b.bestMs === null || ms < b.bestMs) b.bestMs = ms;
  }
}

function finish(b: Bucket) {
  return {
    played: b.played,
    won: b.won,
    winRate: b.played ? b.won / b.played : null,
    perfect: b.perfect,
    points: b.points,
    bestMs: b.bestMs,
    avgMs: b.timed ? Math.round(b.totalMs / b.timed) : null,
  };
}

/** Lifetime statistics for the calling user. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const memberships = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const byDifficulty = Object.fromEntries(
      DIFFICULTIES.map((d) => [d, bucket()]),
    ) as Record<Difficulty, Bucket>;
    const byMode = { solo: bucket(), coop: bucket(), versus: bucket() };
    const all = bucket();
    let mistakes = 0;
    let hints = 0;

    for (const p of memberships) {
      const room = await ctx.db.get(p.roomId);
      if (!room || room.status === "lobby") continue;
      // Abandoned rooms aren't games; keep finished ones that were later closed.
      if (room.status === "closed" && !room.finishedAt) continue;
      mistakes += p.mistakes;
      hints += p.hints ?? 0;

      let won: boolean;
      let ms: number | null = null;
      if (room.mode === "versus") {
        won = room.winnerPlayerId === p._id;
        if (won && room.startedAt && p.finishedAt) {
          ms = p.finishedAt - room.startedAt;
        }
      } else {
        won = room.status === "finished";
        if (won && room.startedAt && room.finishedAt) {
          ms = room.finishedAt - room.startedAt;
        }
      }
      const points = won ? (p.points ?? 0) : 0;
      record(byDifficulty[room.difficulty], won, ms, p.mistakes, points);
      record(byMode[room.mode], won, ms, p.mistakes, points);
      record(all, won, ms, p.mistakes, points);
    }

    const daily = await dailyStatsFor(ctx, user._id);
    const rating = await rankOf(ctx, user._id);

    return {
      rating,
      games: { ...finish(all), mistakes, hints },
      byMode: {
        solo: finish(byMode.solo),
        coop: finish(byMode.coop),
        versus: finish(byMode.versus),
      },
      byDifficulty: Object.fromEntries(
        DIFFICULTIES.map((d) => [d, finish(byDifficulty[d])]),
      ) as Record<Difficulty, ReturnType<typeof finish>>,
      daily,
    };
  },
});
