import { v } from "convex/values";
import { authComponent, requireUser } from "./auth";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { awardDaily } from "./ratings";
import {
  blankCount,
  correctCount,
  dailyDifficulty,
  generatePuzzle,
  isValidDate,
  setCell,
  todayUtc,
  wrongCells,
} from "./lib/sudoku";

const LEADERBOARD_SIZE = 25;
const DAY_MS = 86_400_000;

/** Solved count, current streak, best and average time for a user. */
export async function dailyStatsFor(
  ctx: QueryCtx,
  userId: string,
  attempts?: Doc<"dailyAttempts">[],
) {
  const mine =
    attempts ??
    (await ctx.db
      .query("dailyAttempts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect());

  const finishedDates = new Set<string>();
  let bestMs: number | null = null;
  let totalMs = 0;
  let timed = 0;
  let mistakes = 0;
  let perfect = 0;
  let points = 0;
  for (const a of mine) {
    mistakes += a.mistakes;
    if (!a.finishedAt) continue;
    const daily = await ctx.db.get(a.dailyId);
    if (!daily) continue;
    finishedDates.add(daily.date);
    if (a.mistakes === 0) perfect++;
    points += a.points ?? 0;
    if (a.elapsedMs !== undefined) {
      timed++;
      totalMs += a.elapsedMs;
      if (bestMs === null || a.elapsedMs < bestMs) bestMs = a.elapsedMs;
    }
  }

  const today = todayUtc();
  let streak = 0;
  let cursor = finishedDates.has(today) ? today : todayUtc(Date.now() - DAY_MS);
  while (finishedDates.has(cursor)) {
    streak++;
    cursor = todayUtc(Date.parse(`${cursor}T00:00:00Z`) - DAY_MS);
  }

  let bestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of [...finishedDates].sort()) {
    run =
      prev !== null &&
      Date.parse(`${date}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`) ===
        DAY_MS
        ? run + 1
        : 1;
    bestStreak = Math.max(bestStreak, run);
    prev = date;
  }

  return {
    played: mine.length,
    solved: finishedDates.size,
    streak,
    bestStreak,
    bestMs,
    avgMs: timed ? Math.round(totalMs / timed) : null,
    mistakes,
    perfect,
    points,
  };
}

function assertPlayableDate(date: string) {
  if (!isValidDate(date)) throw new Error("Invalid date");
  // Allow one day of slack for clients whose clock is slightly ahead.
  const max = todayUtc(Date.now() + 24 * 60 * 60 * 1000);
  if (date > max) throw new Error("That day hasn't started yet");
}

async function findDaily(ctx: QueryCtx, date: string) {
  return ctx.db
    .query("dailies")
    .withIndex("by_date", (q) => q.eq("date", date))
    .unique();
}

async function findAttempt(
  ctx: QueryCtx,
  dailyId: Doc<"dailies">["_id"],
  userId: string,
) {
  return ctx.db
    .query("dailyAttempts")
    .withIndex("by_dailyId_userId", (q) =>
      q.eq("dailyId", dailyId).eq("userId", userId),
    )
    .unique();
}

/** Creates the day's puzzle if needed and the caller's attempt. */
export const start = mutation({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    assertPlayableDate(args.date);

    let daily = await findDaily(ctx, args.date);
    if (!daily) {
      const difficulty = dailyDifficulty(args.date);
      const { puzzle, solution } = generatePuzzle(difficulty);
      const id = await ctx.db.insert("dailies", {
        date: args.date,
        difficulty,
        puzzle,
        solution,
        createdAt: Date.now(),
      });
      daily = (await ctx.db.get(id))!;
    }

    const existing = await findAttempt(ctx, daily._id, user._id);
    if (existing) return;

    await ctx.db.insert("dailyAttempts", {
      dailyId: daily._id,
      userId: user._id,
      name: user.name,
      image: user.image ?? undefined,
      board: daily.puzzle,
      mistakes: 0,
      hints: 0,
      startedAt: Date.now(),
    });
  },
});

export const get = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { status: "unauthenticated" as const };
    if (!isValidDate(args.date)) return { status: "not_found" as const };

    const daily = await findDaily(ctx, args.date);
    const difficulty = dailyDifficulty(args.date);
    if (!daily) {
      return { status: "not_started" as const, date: args.date, difficulty };
    }

    const attempts = await ctx.db
      .query("dailyAttempts")
      .withIndex("by_dailyId", (q) => q.eq("dailyId", daily._id))
      .collect();

    const finished = attempts
      .filter((a) => a.finishedAt !== undefined)
      .sort(
        (a, b) =>
          (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0) ||
          a.mistakes - b.mistakes ||
          a.finishedAt! - b.finishedAt!,
      );

    const mine = attempts.find((a) => a.userId === user._id) ?? null;
    const myRank = mine?.finishedAt
      ? finished.findIndex((a) => a._id === mine._id) + 1
      : null;

    return {
      status: "ok" as const,
      daily: {
        date: daily.date,
        difficulty: daily.difficulty,
        puzzle: daily.puzzle,
      },
      totalBlanks: blankCount(daily.puzzle),
      playing: attempts.length,
      finishedCount: finished.length,
      attempt: mine
        ? {
            board: mine.board,
            errors: wrongCells(mine.board, daily.solution),
            filled: correctCount(mine.board, daily.puzzle, daily.solution),
            mistakes: mine.mistakes,
            hints: mine.hints,
            startedAt: mine.startedAt,
            finishedAt: mine.finishedAt,
            elapsedMs: mine.elapsedMs,
            points: mine.points,
            rank: myRank,
          }
        : null,
      leaderboard: finished.slice(0, LEADERBOARD_SIZE).map((a, i) => ({
        rank: i + 1,
        userId: a.userId,
        name: a.name,
        image: a.image,
        elapsedMs: a.elapsedMs ?? 0,
        mistakes: a.mistakes,
        hints: a.hints,
        isMe: a.userId === user._id,
      })),
    };
  },
});

export const place = mutation({
  args: { date: v.string(), cell: v.number(), value: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { cell, value } = args;
    if (!Number.isInteger(cell) || cell < 0 || cell > 80) {
      throw new Error("Invalid cell");
    }
    if (!Number.isInteger(value) || value < 0 || value > 9) {
      throw new Error("Invalid value");
    }
    const daily = await findDaily(ctx, args.date);
    if (!daily) throw new Error("Daily not found");
    const attempt = await findAttempt(ctx, daily._id, user._id);
    if (!attempt) throw new Error("Start the daily first");
    if (attempt.finishedAt) return;
    if (daily.puzzle[cell] !== "0") return;
    if (attempt.board[cell] === String(value)) return;

    const board = setCell(attempt.board, cell, value);
    const isWrong = value !== 0 && String(value) !== daily.solution[cell];
    const solved = board === daily.solution;
    const now = Date.now();
    await ctx.db.patch(attempt._id, {
      board,
      mistakes: isWrong ? attempt.mistakes + 1 : attempt.mistakes,
      ...(solved
        ? { finishedAt: now, elapsedMs: now - attempt.startedAt }
        : {}),
    });
    if (solved) {
      await awardDaily(ctx, daily, (await ctx.db.get(attempt._id))!);
    }
  },
});

export const hint = mutation({
  args: { date: v.string(), cell: v.union(v.number(), v.null()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const daily = await findDaily(ctx, args.date);
    if (!daily) throw new Error("Daily not found");
    const attempt = await findAttempt(ctx, daily._id, user._id);
    if (!attempt) throw new Error("Start the daily first");
    if (attempt.finishedAt) return null;

    let cell = args.cell;
    const isOpen = (i: number) =>
      daily.puzzle[i] === "0" && attempt.board[i] !== daily.solution[i];
    if (cell === null || !Number.isInteger(cell) || !isOpen(cell)) {
      const open: number[] = [];
      for (let i = 0; i < 81; i++) if (isOpen(i)) open.push(i);
      if (open.length === 0) return null;
      cell = open[Math.floor(Math.random() * open.length)]!;
    }

    const value = daily.solution.charCodeAt(cell) - 48;
    const board = setCell(attempt.board, cell, value);
    const solved = board === daily.solution;
    const now = Date.now();
    await ctx.db.patch(attempt._id, {
      board,
      hints: attempt.hints + 1,
      ...(solved
        ? { finishedAt: now, elapsedMs: now - attempt.startedAt }
        : {}),
    });
    if (solved) {
      await awardDaily(ctx, daily, (await ctx.db.get(attempt._id))!);
    }
    return cell;
  },
});

/** Month overview for the calendar: per-day status plus the caller's stats. */
export const calendar = query({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { status: "unauthenticated" as const };
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(args.month)) {
      return { status: "not_found" as const };
    }

    const today = todayUtc();
    const [y, m] = args.month.split("-").map(Number) as [number, number];
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

    const dailies = await ctx.db
      .query("dailies")
      .withIndex("by_date", (q) =>
        q.gte("date", `${args.month}-01`).lte("date", `${args.month}-31`),
      )
      .collect();
    const byDate = new Map(dailies.map((d) => [d.date, d]));

    const myAttempts = await ctx.db
      .query("dailyAttempts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const mineByDaily = new Map(myAttempts.map((a) => [a.dailyId, a]));

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${args.month}-${String(d).padStart(2, "0")}`;
      const daily = byDate.get(date);
      const mine = daily ? mineByDaily.get(daily._id) : undefined;
      let finishedCount = 0;
      if (daily) {
        const attempts = await ctx.db
          .query("dailyAttempts")
          .withIndex("by_dailyId", (q) => q.eq("dailyId", daily._id))
          .collect();
        finishedCount = attempts.filter((a) => a.finishedAt).length;
      }
      days.push({
        date,
        difficulty: dailyDifficulty(date),
        future: date > today,
        isToday: date === today,
        finishedCount,
        mine: mine
          ? {
              finished: mine.finishedAt !== undefined,
              elapsedMs: mine.elapsedMs,
              mistakes: mine.mistakes,
              filled: daily
                ? correctCount(mine.board, daily.puzzle, daily.solution)
                : 0,
            }
          : null,
      });
    }

    const stats = await dailyStatsFor(ctx, user._id, myAttempts);

    return {
      status: "ok" as const,
      month: args.month,
      today,
      days,
      stats,
    };
  },
});
