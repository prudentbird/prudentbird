import { v, type Infer } from "convex/values";
import { authComponent } from "./auth";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { blankCount, type Difficulty } from "./lib/sudoku";
import { scorePoints } from "./lib/rating";
import { solveMode } from "./schema";

const LEADERBOARD_SIZE = 50;

export type SolveMode = Infer<typeof solveMode>;

type Who = { userId: string; name: string; image?: string };

type Solve = {
  mode: SolveMode;
  difficulty: Difficulty;
  elapsedMs: number;
  points: number;
  perfect: boolean;
  finishedAt: number;
};

type Best = { ms: number; mode: SolveMode; difficulty: Difficulty };

/** Records one rated solve: appends to `solves` and folds it into `ratings`. */
async function recordSolve(ctx: MutationCtx, who: Who, solve: Solve) {
  await ctx.db.insert("solves", { userId: who.userId, ...solve });

  const existing = await ctx.db
    .query("ratings")
    .withIndex("by_userId", (q) => q.eq("userId", who.userId))
    .unique();
  const now = Date.now();
  const best =
    existing?.bestMs === undefined || solve.elapsedMs < existing.bestMs
      ? {
          bestMs: solve.elapsedMs,
          bestMode: solve.mode,
          bestDifficulty: solve.difficulty,
        }
      : {};
  if (existing) {
    await ctx.db.patch(existing._id, {
      name: who.name,
      image: who.image,
      points: existing.points + solve.points,
      solves: existing.solves + 1,
      perfectSolves: existing.perfectSolves + (solve.perfect ? 1 : 0),
      ...best,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("ratings", {
      ...who,
      points: solve.points,
      solves: 1,
      perfectSolves: solve.perfect ? 1 : 0,
      ...best,
      updatedAt: now,
    });
  }
}

/** Per-player points for a finished room. Pure, so the rebuild can reuse it. */
export function roomAwards(
  room: Doc<"rooms">,
  players: Doc<"players">[],
): Array<{ player: Doc<"players">; points: number }> {
  if (room.status !== "finished" || !room.startedAt || !room.finishedAt) {
    return [];
  }
  const elapsedMs = room.finishedAt - room.startedAt;

  if (room.mode === "versus") {
    const winner = players.find((p) => p._id === room.winnerPlayerId);
    if (!winner) return [];
    return [
      {
        player: winner,
        points: scorePoints({
          difficulty: room.difficulty,
          elapsedMs,
          mistakes: winner.mistakes,
          hints: winner.hints ?? 0,
        }),
      },
    ];
  }

  const totalBlanks = blankCount(room.puzzle);
  const filled = new Map<string, number>();
  for (let i = 0; i < 81; i++) {
    const owner = room.owners[i];
    if (owner && room.board[i] === room.solution[i]) {
      filled.set(owner, (filled.get(owner) ?? 0) + 1);
    }
  }
  const awards = [];
  for (const p of players) {
    const share =
      room.mode === "solo" ? 1 : (filled.get(p._id) ?? 0) / totalBlanks;
    if (share <= 0) continue;
    awards.push({
      player: p,
      points: scorePoints({
        difficulty: room.difficulty,
        elapsedMs,
        mistakes: p.mistakes,
        hints: p.hints ?? 0,
        share,
      }),
    });
  }
  return awards;
}

/** Awards points for a room that just finished. Call once per round. */
export async function awardRoom(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  players: Doc<"players">[],
) {
  const awards = roomAwards(room, players);
  if (awards.length === 0) return;
  const finishedAt = room.finishedAt!;
  const elapsedMs = finishedAt - room.startedAt!;
  for (const { player, points } of awards) {
    await ctx.db.patch(player._id, { points });
    await recordSolve(
      ctx,
      { userId: player.userId, name: player.name, image: player.image },
      {
        mode: room.mode,
        difficulty: room.difficulty,
        elapsedMs,
        points,
        perfect: player.mistakes === 0,
        finishedAt,
      },
    );
  }
}

export function dailyAward(
  daily: Doc<"dailies">,
  attempt: Doc<"dailyAttempts">,
): number {
  if (attempt.elapsedMs === undefined) return 0;
  return scorePoints({
    difficulty: daily.difficulty,
    elapsedMs: attempt.elapsedMs,
    mistakes: attempt.mistakes,
    hints: attempt.hints,
  });
}

export async function awardDaily(
  ctx: MutationCtx,
  daily: Doc<"dailies">,
  attempt: Doc<"dailyAttempts">,
) {
  if (attempt.elapsedMs === undefined || attempt.finishedAt === undefined) {
    return;
  }
  const points = dailyAward(daily, attempt);
  await ctx.db.patch(attempt._id, { points });
  await recordSolve(
    ctx,
    { userId: attempt.userId, name: attempt.name, image: attempt.image },
    {
      mode: "daily",
      difficulty: daily.difficulty,
      elapsedMs: attempt.elapsedMs,
      points,
      perfect: attempt.mistakes === 0,
      finishedAt: attempt.finishedAt,
    },
  );
}

export async function rankOf(
  ctx: QueryCtx,
  userId: string,
): Promise<{ rank: number; points: number; total: number } | null> {
  const all = await ctx.db
    .query("ratings")
    .withIndex("by_points")
    .order("desc")
    .collect();
  const idx = all.findIndex((r) => r.userId === userId);
  if (idx === -1) return null;
  return { rank: idx + 1, points: all[idx]!.points, total: all.length };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the current week: Monday 00:00 UTC. */
export function weekStartUtc(now: number): number {
  const d = new Date(now);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return (
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
    sinceMonday * DAY_MS
  );
}

type Standing = {
  userId: string;
  name: string;
  image?: string;
  points: number;
  solves: number;
  perfectSolves: number;
  best: Best | null;
};

async function allTimeStandings(ctx: QueryCtx): Promise<Standing[]> {
  const all = await ctx.db
    .query("ratings")
    .withIndex("by_points")
    .order("desc")
    .collect();
  return all.map((r) => ({
    userId: r.userId,
    name: r.name,
    image: r.image,
    points: r.points,
    solves: r.solves,
    perfectSolves: r.perfectSolves,
    best:
      r.bestMs !== undefined && r.bestMode && r.bestDifficulty
        ? { ms: r.bestMs, mode: r.bestMode, difficulty: r.bestDifficulty }
        : null,
  }));
}

async function weeklyStandings(
  ctx: QueryCtx,
  since: number,
): Promise<Standing[]> {
  const solves = await ctx.db
    .query("solves")
    .withIndex("by_finishedAt", (q) => q.gte("finishedAt", since))
    .collect();

  const byUser = new Map<string, Standing>();
  for (const s of solves) {
    let row = byUser.get(s.userId);
    if (!row) {
      row = {
        userId: s.userId,
        name: "",
        points: 0,
        solves: 0,
        perfectSolves: 0,
        best: null,
      };
      byUser.set(s.userId, row);
    }
    row.points += s.points;
    row.solves += 1;
    if (s.perfect) row.perfectSolves += 1;
    if (!row.best || s.elapsedMs < row.best.ms) {
      row.best = { ms: s.elapsedMs, mode: s.mode, difficulty: s.difficulty };
    }
  }

  // Names and avatars live on `ratings`, which every solver has a row in.
  for (const row of byUser.values()) {
    const rating = await ctx.db
      .query("ratings")
      .withIndex("by_userId", (q) => q.eq("userId", row.userId))
      .unique();
    if (rating) {
      row.name = rating.name;
      row.image = rating.image;
    }
  }

  return [...byUser.values()].sort(
    (a, b) =>
      b.points - a.points ||
      (a.best?.ms ?? Infinity) - (b.best?.ms ?? Infinity),
  );
}

export const period = v.union(v.literal("all"), v.literal("week"));

export const leaderboard = query({
  args: { period },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    const now = Date.now();
    const weekStart = weekStartUtc(now);
    const standings =
      args.period === "week"
        ? await weeklyStandings(ctx, weekStart)
        : await allTimeStandings(ctx);
    const meIdx = user ? standings.findIndex((r) => r.userId === user._id) : -1;
    const me = meIdx === -1 ? null : standings[meIdx]!;
    return {
      period: args.period,
      /** When the weekly board rolls over (next Monday 00:00 UTC). */
      resetsAt: weekStart + 7 * DAY_MS,
      total: standings.length,
      me: me ? { rank: meIdx + 1, points: me.points } : null,
      rows: standings.slice(0, LEADERBOARD_SIZE).map((r, i) => ({
        rank: i + 1,
        ...r,
        isMe: user ? r.userId === user._id : false,
      })),
    };
  },
});

/**
 * Recomputes every rating and solve from finished rooms and dailies.
 * Run after changing the formula: `npx convex run ratings:rebuild`.
 */
export const rebuild = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const r of await ctx.db.query("ratings").collect()) {
      await ctx.db.delete(r._id);
    }
    for (const s of await ctx.db.query("solves").collect()) {
      await ctx.db.delete(s._id);
    }

    const rooms = await ctx.db.query("rooms").collect();
    for (const room of rooms) {
      const players = await ctx.db
        .query("players")
        .withIndex("by_roomId", (q) => q.eq("roomId", room._id))
        .collect();
      for (const p of players) {
        if (p.points !== undefined)
          await ctx.db.patch(p._id, { points: undefined });
      }
      await awardRoom(ctx, room, players);
    }

    const attempts = await ctx.db.query("dailyAttempts").collect();
    for (const attempt of attempts) {
      if (!attempt.finishedAt) continue;
      const daily = await ctx.db.get(attempt.dailyId);
      if (!daily) continue;
      await awardDaily(ctx, daily, attempt);
    }
  },
});
