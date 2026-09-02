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

type Who = { userId: string; name: string; image?: string };

async function addPoints(
  ctx: MutationCtx,
  who: Who,
  points: number,
  perfect: boolean,
) {
  const existing = await ctx.db
    .query("ratings")
    .withIndex("by_userId", (q) => q.eq("userId", who.userId))
    .unique();
  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      name: who.name,
      image: who.image,
      points: existing.points + points,
      solves: existing.solves + 1,
      perfectSolves: existing.perfectSolves + (perfect ? 1 : 0),
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("ratings", {
      ...who,
      points,
      solves: 1,
      perfectSolves: perfect ? 1 : 0,
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
  for (const { player, points } of roomAwards(room, players)) {
    await ctx.db.patch(player._id, { points });
    await addPoints(
      ctx,
      { userId: player.userId, name: player.name, image: player.image },
      points,
      player.mistakes === 0,
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
  await addPoints(
    ctx,
    { userId: attempt.userId, name: attempt.name, image: attempt.image },
    points,
    attempt.mistakes === 0,
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

export const leaderboard = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    const all = await ctx.db
      .query("ratings")
      .withIndex("by_points")
      .order("desc")
      .collect();
    const meIdx = user ? all.findIndex((r) => r.userId === user._id) : -1;
    return {
      total: all.length,
      me: meIdx === -1 ? null : { rank: meIdx + 1, points: all[meIdx]!.points },
      rows: all.slice(0, LEADERBOARD_SIZE).map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        name: r.name,
        image: r.image,
        points: r.points,
        solves: r.solves,
        perfectSolves: r.perfectSolves,
        isMe: user ? r.userId === user._id : false,
      })),
    };
  },
});

/**
 * Recomputes every rating from finished rooms and dailies.
 * Run after changing the formula: `npx convex run ratings:rebuild`.
 */
export const rebuild = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const r of await ctx.db.query("ratings").collect()) {
      await ctx.db.delete(r._id);
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
