import { v } from "convex/values";
import { authComponent } from "./auth";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { blankCount } from "./lib/sudoku";
import { scorePoints } from "./lib/rating";

const LEADERBOARD_SIZE = 50;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export type SolveMode = "solo" | "coop" | "versus" | "daily";
type Difficulty = "easy" | "medium" | "hard" | "expert";

type Who = { userId: string; name: string; image?: string };

type SolveInfo = {
  points: number;
  elapsedMs: number;
  mode: SolveMode;
  difficulty: Difficulty;
  finishedAt: number;
  perfect: boolean;
  /**
   * Stable id for the rated solve (`room:<roomId>:<round>:<userId>` or
   * `dailyAttempt:<attemptId>`). Skipped when already recorded, which makes
   * rebuild backfills idempotent.
   */
  sourceKey?: string;
};

/** Monday 00:00 UTC for the week containing `now`. */
export function weekStartUtc(now: number): number {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0 … Sunday = 6
  const midnight = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
  );
  return midnight - day * DAY_MS;
}

const MODE_POINT_KEY: Record<
  SolveMode,
  "soloPoints" | "coopPoints" | "versusPoints" | "dailyPoints"
> = {
  solo: "soloPoints",
  coop: "coopPoints",
  versus: "versusPoints",
  daily: "dailyPoints",
};

const MODE_BEST_KEY: Record<
  SolveMode,
  "soloBestMs" | "coopBestMs" | "versusBestMs" | "dailyBestMs"
> = {
  solo: "soloBestMs",
  coop: "coopBestMs",
  versus: "versusBestMs",
  daily: "dailyBestMs",
};

const MODE_SOLVES_KEY: Record<
  SolveMode,
  "soloSolves" | "coopSolves" | "versusSolves" | "dailySolves"
> = {
  solo: "soloSolves",
  coop: "coopSolves",
  versus: "versusSolves",
  daily: "dailySolves",
};

async function hasSolveEvent(ctx: MutationCtx, sourceKey: string) {
  const existing = await ctx.db
    .query("solveEvents")
    .withIndex("by_sourceKey", (q) => q.eq("sourceKey", sourceKey))
    .unique();
  return existing !== null;
}

async function addPoints(ctx: MutationCtx, who: Who, solve: SolveInfo) {
  if (solve.sourceKey && (await hasSolveEvent(ctx, solve.sourceKey))) return;

  // Persistent ledger so weekly boards + best times survive room cleanup.
  await ctx.db.insert("solveEvents", {
    userId: who.userId,
    name: who.name,
    image: who.image,
    points: solve.points,
    elapsedMs: solve.elapsedMs,
    mode: solve.mode,
    difficulty: solve.difficulty,
    finishedAt: solve.finishedAt,
    perfect: solve.perfect,
    sourceKey: solve.sourceKey,
  });

  await applySolve(ctx, who, solve);
}

/** Folds one solve into the per-user ratings row (no ledger write). */
async function applySolve(ctx: MutationCtx, who: Who, solve: SolveInfo) {
  const existing = await ctx.db
    .query("ratings")
    .withIndex("by_userId", (q) => q.eq("userId", who.userId))
    .unique();
  const now = Date.now();
  const pointKey = MODE_POINT_KEY[solve.mode];
  const bestKey = MODE_BEST_KEY[solve.mode];
  const solvesKey = MODE_SOLVES_KEY[solve.mode];

  if (existing) {
    const prevBest = existing.bestTimeMs;
    const isBest = prevBest === undefined || solve.elapsedMs < prevBest;
    const prevModeBest = existing[bestKey];
    await ctx.db.patch(existing._id, {
      name: who.name,
      image: who.image,
      points: existing.points + solve.points,
      solves: existing.solves + 1,
      perfectSolves: existing.perfectSolves + (solve.perfect ? 1 : 0),
      updatedAt: now,
      ...(isBest
        ? {
            bestTimeMs: solve.elapsedMs,
            bestMode: solve.mode,
            bestDifficulty: solve.difficulty,
          }
        : {}),
      [pointKey]: (existing[pointKey] ?? 0) + solve.points,
      [solvesKey]: (existing[solvesKey] ?? 0) + 1,
      ...(prevModeBest === undefined || solve.elapsedMs < prevModeBest
        ? { [bestKey]: solve.elapsedMs }
        : {}),
    });
  } else {
    await ctx.db.insert("ratings", {
      ...who,
      points: solve.points,
      solves: 1,
      perfectSolves: solve.perfect ? 1 : 0,
      updatedAt: now,
      bestTimeMs: solve.elapsedMs,
      bestMode: solve.mode,
      bestDifficulty: solve.difficulty,
      soloPoints: solve.mode === "solo" ? solve.points : 0,
      coopPoints: solve.mode === "coop" ? solve.points : 0,
      versusPoints: solve.mode === "versus" ? solve.points : 0,
      dailyPoints: solve.mode === "daily" ? solve.points : 0,
      soloSolves: solve.mode === "solo" ? 1 : 0,
      coopSolves: solve.mode === "coop" ? 1 : 0,
      versusSolves: solve.mode === "versus" ? 1 : 0,
      dailySolves: solve.mode === "daily" ? 1 : 0,
      ...(solve.mode === "solo" ? { soloBestMs: solve.elapsedMs } : {}),
      ...(solve.mode === "coop" ? { coopBestMs: solve.elapsedMs } : {}),
      ...(solve.mode === "versus" ? { versusBestMs: solve.elapsedMs } : {}),
      ...(solve.mode === "daily" ? { dailyBestMs: solve.elapsedMs } : {}),
    });
  }
}

/** Per-player points for a finished room. Pure, so the rebuild can reuse it. */
export function roomAwards(
  room: Doc<"rooms">,
  players: Doc<"players">[],
): Array<{ player: Doc<"players">; solve: SolveInfo }> {
  if (room.status !== "finished" || !room.startedAt || !room.finishedAt) {
    return [];
  }
  const roomElapsed = room.finishedAt - room.startedAt;

  if (room.mode === "versus") {
    const winner = players.find((p) => p._id === room.winnerPlayerId);
    if (!winner) return [];
    const elapsed =
      winner.finishedAt && room.startedAt
        ? winner.finishedAt - room.startedAt
        : roomElapsed;
    return [
      {
        player: winner,
        solve: {
          points: scorePoints({
            difficulty: room.difficulty,
            elapsedMs: elapsed,
            mistakes: winner.mistakes,
            hints: winner.hints ?? 0,
          }),
          elapsedMs: elapsed,
          mode: "versus",
          difficulty: room.difficulty,
          finishedAt: room.finishedAt,
          perfect: winner.mistakes === 0,
        },
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
      solve: {
        points: scorePoints({
          difficulty: room.difficulty,
          elapsedMs: roomElapsed,
          mistakes: p.mistakes,
          hints: p.hints ?? 0,
          share,
        }),
        elapsedMs: roomElapsed,
        mode: room.mode,
        difficulty: room.difficulty,
        finishedAt: room.finishedAt,
        perfect: p.mistakes === 0,
      },
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
  for (const { player, solve } of roomAwards(room, players)) {
    await ctx.db.patch(player._id, { points: solve.points });
    await addPoints(
      ctx,
      { userId: player.userId, name: player.name, image: player.image },
      {
        ...solve,
        sourceKey: `room:${room._id}:${room.round}:${player.userId}`,
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
  const points = dailyAward(daily, attempt);
  await ctx.db.patch(attempt._id, { points });
  const elapsedMs =
    attempt.elapsedMs ??
    (attempt.finishedAt ? attempt.finishedAt - attempt.startedAt : undefined);
  if (elapsedMs === undefined || !attempt.finishedAt) return;
  await addPoints(
    ctx,
    { userId: attempt.userId, name: attempt.name, image: attempt.image },
    {
      points,
      elapsedMs,
      mode: "daily",
      difficulty: daily.difficulty,
      finishedAt: attempt.finishedAt,
      perfect: attempt.mistakes === 0,
      sourceKey: `dailyAttempt:${attempt._id}`,
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

type Row = {
  rank: number;
  userId: string;
  name: string;
  image?: string;
  points: number;
  solves: number;
  perfectSolves: number;
  bestTimeMs: number | null;
  bestMode: SolveMode | null;
  bestDifficulty: Difficulty | null;
  byMode: Record<
    SolveMode,
    { points: number; bestMs: number | null; solves: number }
  >;
  isMe: boolean;
};

function toRow(
  r: Doc<"ratings">,
  i: number,
  userId: string | undefined,
): Row {
  return {
    rank: i + 1,
    userId: r.userId,
    name: r.name,
    image: r.image,
    points: r.points,
    solves: r.solves,
    perfectSolves: r.perfectSolves,
    bestTimeMs: r.bestTimeMs ?? null,
    bestMode: (r.bestMode as SolveMode | undefined) ?? null,
    bestDifficulty: (r.bestDifficulty as Difficulty | undefined) ?? null,
    byMode: {
      solo: {
        points: r.soloPoints ?? 0,
        bestMs: r.soloBestMs ?? null,
        solves: r.soloSolves ?? 0,
      },
      coop: {
        points: r.coopPoints ?? 0,
        bestMs: r.coopBestMs ?? null,
        solves: r.coopSolves ?? 0,
      },
      versus: {
        points: r.versusPoints ?? 0,
        bestMs: r.versusBestMs ?? null,
        solves: r.versusSolves ?? 0,
      },
      daily: {
        points: r.dailyPoints ?? 0,
        bestMs: r.dailyBestMs ?? null,
        solves: r.dailySolves ?? 0,
      },
    },
    isMe: userId ? r.userId === userId : false,
  };
}

export const leaderboard = query({
  args: {
    period: v.optional(v.union(v.literal("all"), v.literal("week"))),
    /**
     * Client-computed Monday 00:00 UTC. Passing it makes the weekly query
     * re-run when the week rolls over while the page stays open.
     */
    anchorWeekStart: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const period = args.period ?? "all";
    const user = await authComponent.safeGetAuthUser(ctx);
    const userId = user?._id;
    const now = Date.now();
    const start =
      period === "week" && args.anchorWeekStart !== undefined
        ? args.anchorWeekStart
        : weekStartUtc(now);

    if (period === "all") {
      const all = await ctx.db
        .query("ratings")
        .withIndex("by_points")
        .order("desc")
        .collect();
      const meIdx = userId ? all.findIndex((r) => r.userId === userId) : -1;
      return {
        period: "all" as const,
        total: all.length,
        me:
          meIdx === -1 ? null : { rank: meIdx + 1, points: all[meIdx]!.points },
        weekStart: start,
        weekEnd: start + WEEK_MS,
        rows: all.slice(0, LEADERBOARD_SIZE).map((r, i) => toRow(r, i, userId)),
      };
    }

    // Weekly: aggregate the persistent solve ledger since Monday 00:00 UTC.
    const events = await ctx.db
      .query("solveEvents")
      .withIndex("by_finishedAt", (q) => q.gte("finishedAt", start))
      .collect();
    const byUser = new Map<
      string,
      {
        name: string;
        image?: string;
        points: number;
        solves: number;
        perfect: number;
        bestMs: number | null;
        bestMode: SolveMode | null;
        bestDifficulty: Difficulty | null;
        modes: Record<
          SolveMode,
          { points: number; bestMs: number | null; solves: number }
        >;
      }
    >();
    for (const e of events) {
      let agg = byUser.get(e.userId);
      if (!agg) {
        agg = {
          name: e.name,
          image: e.image,
          points: 0,
          solves: 0,
          perfect: 0,
          bestMs: null,
          bestMode: null,
          bestDifficulty: null,
          modes: {
            solo: { points: 0, bestMs: null, solves: 0 },
            coop: { points: 0, bestMs: null, solves: 0 },
            versus: { points: 0, bestMs: null, solves: 0 },
            daily: { points: 0, bestMs: null, solves: 0 },
          },
        };
        byUser.set(e.userId, agg);
      }
      agg.name = e.name;
      agg.image = e.image;
      agg.points += e.points;
      agg.solves += 1;
      if (e.perfect) agg.perfect += 1;
      if (agg.bestMs === null || e.elapsedMs < agg.bestMs) {
        agg.bestMs = e.elapsedMs;
        agg.bestMode = e.mode as SolveMode;
        agg.bestDifficulty = e.difficulty as Difficulty;
      }
      const m = agg.modes[e.mode as SolveMode];
      m.points += e.points;
      m.solves += 1;
      if (m.bestMs === null || e.elapsedMs < m.bestMs) m.bestMs = e.elapsedMs;
    }
    const sorted = [...byUser.entries()].sort(
      (a, b) =>
        b[1].points - a[1].points ||
        (a[1].bestMs ?? Infinity) - (b[1].bestMs ?? Infinity),
    );
    const meIdx = userId ? sorted.findIndex(([id]) => id === userId) : -1;
    return {
      period: "week" as const,
      total: sorted.length,
      me:
        meIdx === -1
          ? null
          : { rank: meIdx + 1, points: sorted[meIdx]![1].points },
      weekStart: start,
      weekEnd: start + WEEK_MS,
      rows: sorted.slice(0, LEADERBOARD_SIZE).map(([id, a], i) => ({
        rank: i + 1,
        userId: id,
        name: a.name,
        image: a.image,
        points: a.points,
        solves: a.solves,
        perfectSolves: a.perfect,
        bestTimeMs: a.bestMs,
        bestMode: a.bestMode,
        bestDifficulty: a.bestDifficulty,
        byMode: a.modes,
        isMe: userId ? id === userId : false,
      })) satisfies Row[],
    };
  },
});

/**
 * Recomputes every rating from the solve ledger, backfilling any finished
 * rooms and dailies missing from it.
 * Run after changing the formula: `npx convex run ratings:rebuild`.
 *
 * The ledger is the canonical history: it is never deleted here, because
 * rooms are removed by TTL cleanup and could not be reconstructed. New
 * solves are inserted idempotently via their stable `sourceKey`.
 */
export const rebuild = internalMutation({
  args: {},
  handler: async (ctx) => {
    const ledger = await ctx.db.query("solveEvents").collect();
    const known = new Set(
      ledger.map((e) => e.sourceKey).filter((k) => k !== undefined),
    );

    // Backfill solves missing from the ledger (idempotent via sourceKey).
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
      for (const { player, solve } of roomAwards(room, players)) {
        const sourceKey = `room:${room._id}:${room.round}:${player.userId}`;
        await ctx.db.patch(player._id, { points: solve.points });
        if (known.has(sourceKey)) continue;
        known.add(sourceKey);
        await addPoints(
          ctx,
          { userId: player.userId, name: player.name, image: player.image },
          { ...solve, sourceKey },
        );
      }
    }

    const attempts = await ctx.db.query("dailyAttempts").collect();
    for (const attempt of attempts) {
      if (!attempt.finishedAt) continue;
      const daily = await ctx.db.get(attempt.dailyId);
      if (!daily) continue;
      const sourceKey = `dailyAttempt:${attempt._id}`;
      if (known.has(sourceKey)) continue;
      known.add(sourceKey);
      const points = dailyAward(daily, attempt);
      await ctx.db.patch(attempt._id, { points });
      const elapsedMs =
        attempt.elapsedMs ??
        (attempt.finishedAt ? attempt.finishedAt - attempt.startedAt : undefined);
      if (elapsedMs === undefined || !attempt.finishedAt) continue;
      await addPoints(
        ctx,
        { userId: attempt.userId, name: attempt.name, image: attempt.image },
        {
          points,
          elapsedMs,
          mode: "daily",
          difficulty: daily.difficulty,
          finishedAt: attempt.finishedAt,
          perfect: attempt.mistakes === 0,
          sourceKey,
        },
      );
    }

    // Re-aggregate every rating from the full ledger (now including backfills).
    for (const r of await ctx.db.query("ratings").collect()) {
      await ctx.db.delete(r._id);
    }
    for (const e of await ctx.db.query("solveEvents").collect()) {
      await applySolve(
        ctx,
        { userId: e.userId, name: e.name, image: e.image },
        {
          points: e.points,
          elapsedMs: e.elapsedMs,
          mode: e.mode as SolveMode,
          difficulty: e.difficulty as Difficulty,
          finishedAt: e.finishedAt,
          perfect: e.perfect,
        },
      );
    }
  },
});

/**
 * Deletes solve ledger rows older than the retention window. The weekly
 * board only reads the current week, and lifetime totals live on the
 * ratings rows, so old events are expendable history. Runs daily via cron.
 */
const SOLVE_EVENT_RETENTION_MS = 180 * DAY_MS;

export const cleanupSolveEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - SOLVE_EVENT_RETENTION_MS;
    const stale = await ctx.db
      .query("solveEvents")
      .withIndex("by_finishedAt", (q) => q.lt("finishedAt", cutoff))
      .take(500);
    for (const e of stale) await ctx.db.delete(e._id);
  },
});
