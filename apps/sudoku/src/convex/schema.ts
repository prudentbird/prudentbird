import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const mode = v.union(
  v.literal("solo"),
  v.literal("coop"),
  v.literal("versus"),
);
export const difficulty = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
  v.literal("expert"),
);
export const solveMode = v.union(
  v.literal("solo"),
  v.literal("coop"),
  v.literal("versus"),
  v.literal("daily"),
);
export const roomStatus = v.union(
  v.literal("lobby"),
  v.literal("playing"),
  v.literal("finished"),
  v.literal("closed"),
);
export const closeReason = v.union(v.literal("host"), v.literal("inactivity"));

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    mode,
    difficulty,
    status: roomStatus,
    hostUserId: v.string(),
    /** 81 chars, "0" for blanks. Never sent to clients. */
    solution: v.string(),
    /** 81 chars, the givens. */
    puzzle: v.string(),
    /** Co-op shared board (81 chars). Unused in versus. */
    board: v.string(),
    /** Co-op: player id that filled each cell, or null. */
    owners: v.array(v.union(v.id("players"), v.null())),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    winnerPlayerId: v.optional(v.id("players")),
    /** Increments on every rematch so clients can reset local state. */
    round: v.number(),
    /** Set on games imported from guest play, to make imports idempotent. */
    importKey: v.optional(v.string()),
    closedAt: v.optional(v.number()),
    closedReason: v.optional(closeReason),
  })
    .index("by_code", ["code"])
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status"])
    .index("by_importKey", ["importKey"]),

  players: defineTable({
    roomId: v.id("rooms"),
    userId: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    /** Index into the shared player palette. */
    color: v.number(),
    joinedAt: v.number(),
    lastSeen: v.number(),
    /** Versus: the player's own board (81 chars). */
    board: v.string(),
    mistakes: v.number(),
    hints: v.optional(v.number()),
    /** Rating points earned in this room's latest finished round. */
    points: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    /** Co-op: currently focused cell for live cursors. */
    cursor: v.optional(v.number()),
  })
    .index("by_roomId", ["roomId"])
    .index("by_roomId_userId", ["roomId", "userId"])
    .index("by_userId", ["userId"]),

  /** One puzzle per UTC day, shared by everyone. */
  dailies: defineTable({
    /** YYYY-MM-DD (UTC) */
    date: v.string(),
    difficulty,
    puzzle: v.string(),
    solution: v.string(),
    createdAt: v.number(),
  }).index("by_date", ["date"]),

  dailyAttempts: defineTable({
    dailyId: v.id("dailies"),
    userId: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    board: v.string(),
    mistakes: v.number(),
    hints: v.number(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    elapsedMs: v.optional(v.number()),
    points: v.optional(v.number()),
  })
    .index("by_dailyId", ["dailyId"])
    .index("by_dailyId_userId", ["dailyId", "userId"])
    .index("by_userId", ["userId"]),

  /** One row per user: lifetime rating points for the global leaderboard. */
  ratings: defineTable({
    userId: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    points: v.number(),
    solves: v.number(),
    perfectSolves: v.number(),
    updatedAt: v.number(),
    /** Fastest solve ever + the mode/difficulty it happened in. */
    bestTimeMs: v.optional(v.number()),
    bestMode: v.optional(solveMode),
    bestDifficulty: v.optional(difficulty),
    /** Lifetime points split by mode. */
    soloPoints: v.optional(v.number()),
    coopPoints: v.optional(v.number()),
    versusPoints: v.optional(v.number()),
    dailyPoints: v.optional(v.number()),
    /** Fastest solve per mode. */
    soloBestMs: v.optional(v.number()),
    coopBestMs: v.optional(v.number()),
    versusBestMs: v.optional(v.number()),
    dailyBestMs: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_points", ["points"]),

  /**
   * One row per rated solve. Persistent ledger (rooms are deleted after the
   * TTL) so the weekly leaderboard and fastest times survive cleanup.
   */
  solveEvents: defineTable({
    userId: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    points: v.number(),
    elapsedMs: v.number(),
    mode: solveMode,
    difficulty,
    finishedAt: v.number(),
    perfect: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_finishedAt", ["finishedAt"])
    .index("by_userId_finishedAt", ["userId", "finishedAt"]),
});
