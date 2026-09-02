import { v } from "convex/values";
import { difficulty, mode } from "./schema";
import { authComponent, requireUser } from "./auth";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  blankCount,
  correctCount,
  generatePuzzle,
  isCompleteGrid,
  wrongCells,
} from "./lib/sudoku";
import { awardRoom } from "./ratings";

export const MAX_PLAYERS = 8;
/** Lobby/in-play rooms with no player seen for this long are closed. */
export const INACTIVITY_MS = 5 * 60_000;
/** A player is considered online if they've pinged within this window. */
export const PRESENCE_WINDOW_MS = 45_000;
const ROOM_TTL_MS = 2 * 24 * 60 * 60 * 1000;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function findRoomByCode(ctx: QueryCtx, code: string) {
  return ctx.db
    .query("rooms")
    .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
    .unique();
}

async function findPlayer(ctx: QueryCtx, roomId: Id<"rooms">, userId: string) {
  return ctx.db
    .query("players")
    .withIndex("by_roomId_userId", (q) =>
      q.eq("roomId", roomId).eq("userId", userId),
    )
    .unique();
}

async function listPlayers(ctx: QueryCtx, roomId: Id<"rooms">) {
  return ctx.db
    .query("players")
    .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
    .collect();
}

export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
): Promise<{ room: Doc<"rooms">; player: Doc<"players"> }> {
  const user = await requireUser(ctx);
  const room = await ctx.db.get(roomId);
  if (!room) throw new Error("Room not found");
  const player = await findPlayer(ctx, roomId, user._id);
  if (!player) throw new Error("Not a member of this room");
  return { room, player };
}

/** Creates a room with a freshly generated puzzle. Returns the room code. */
export const create = mutation({
  args: { mode, difficulty },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { puzzle, solution } = generatePuzzle(args.difficulty);

    let code = randomCode();
    while (await findRoomByCode(ctx, code)) code = randomCode();

    const now = Date.now();
    const solo = args.mode === "solo";
    const roomId = await ctx.db.insert("rooms", {
      code,
      mode: args.mode,
      difficulty: args.difficulty,
      status: solo ? "playing" : "lobby",
      hostUserId: user._id,
      puzzle,
      solution,
      board: puzzle,
      owners: new Array(81).fill(null),
      createdAt: now,
      ...(solo ? { startedAt: now } : {}),
      round: 1,
    });

    await ctx.db.insert("players", {
      roomId,
      userId: user._id,
      name: user.name,
      image: user.image ?? undefined,
      color: 0,
      joinedAt: now,
      lastSeen: now,
      board: puzzle,
      mistakes: 0,
      hints: 0,
    });

    return code;
  },
});

/** Joins (or re-joins) a room by code. Idempotent for existing members. */
export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const room = await findRoomByCode(ctx, args.code);
    if (!room) throw new Error("Room not found");

    if (room.status === "closed") throw new Error("This room has ended");

    const now = Date.now();
    const existing = await findPlayer(ctx, room._id, user._id);
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeen: now,
        name: user.name,
        image: user.image ?? undefined,
      });
      return room.code;
    }

    if (room.mode === "solo") throw new Error("This is a solo game");
    const players = await listPlayers(ctx, room._id);
    if (players.length >= MAX_PLAYERS) throw new Error("Room is full");

    const used = new Set(players.map((p) => p.color));
    let color = 0;
    while (used.has(color)) color++;

    await ctx.db.insert("players", {
      roomId: room._id,
      userId: user._id,
      name: user.name,
      image: user.image ?? undefined,
      color,
      joinedAt: now,
      lastSeen: now,
      board: room.puzzle,
      mistakes: 0,
      hints: 0,
    });

    return room.code;
  },
});

export const start = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const { room, player } = await requireMember(ctx, args.roomId);
    if (room.hostUserId !== player.userId) {
      throw new Error("Only the host can start the game");
    }
    if (room.status !== "lobby") return;
    await ctx.db.patch(room._id, { status: "playing", startedAt: Date.now() });
  },
});

/** Host ends the room for everyone. */
export const close = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const { room, player } = await requireMember(ctx, args.roomId);
    if (room.hostUserId !== player.userId) {
      throw new Error("Only the host can end the room");
    }
    if (room.status === "closed") return;
    await ctx.db.patch(room._id, {
      status: "closed",
      closedAt: Date.now(),
      closedReason: "host",
    });
  },
});

/** Closes lobby/in-play rooms nobody has touched for INACTIVITY_MS. Cron. */
export const closeInactive = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - INACTIVITY_MS;
    for (const status of ["lobby", "playing"] as const) {
      const rooms = await ctx.db
        .query("rooms")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
      for (const room of rooms) {
        if (room.createdAt > cutoff) continue;
        const players = await listPlayers(ctx, room._id);
        const lastSeen = Math.max(0, ...players.map((p) => p.lastSeen));
        if (lastSeen > cutoff) continue;
        await ctx.db.patch(room._id, {
          status: "closed",
          closedAt: Date.now(),
          closedReason: "inactivity",
        });
      }
    }
  },
});

/** Host starts a new round in the same room with a fresh puzzle. */
export const rematch = mutation({
  args: { roomId: v.id("rooms"), difficulty: v.optional(difficulty) },
  handler: async (ctx, args) => {
    const { room, player } = await requireMember(ctx, args.roomId);
    if (room.hostUserId !== player.userId) {
      throw new Error("Only the host can start a rematch");
    }
    if (room.status === "closed") throw new Error("This room has ended");
    const nextDifficulty = args.difficulty ?? room.difficulty;
    const { puzzle, solution } = generatePuzzle(nextDifficulty);
    const now = Date.now();
    await ctx.db.patch(room._id, {
      difficulty: nextDifficulty,
      puzzle,
      solution,
      board: puzzle,
      owners: new Array(81).fill(null),
      status: "playing",
      startedAt: now,
      finishedAt: undefined,
      winnerPlayerId: undefined,
      round: room.round + 1,
    });
    const players = await listPlayers(ctx, room._id);
    for (const p of players) {
      await ctx.db.patch(p._id, {
        board: puzzle,
        mistakes: 0,
        hints: 0,
        finishedAt: undefined,
        cursor: undefined,
      });
    }
  },
});

/**
 * Live view of a room for the calling user. The solution never leaves the
 * server: clients get the list of wrong cells instead.
 */
export const get = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { status: "unauthenticated" as const };

    const room = await findRoomByCode(ctx, args.code);
    if (!room) return { status: "not_found" as const };

    const players = await listPlayers(ctx, room._id);
    const me = players.find((p) => p.userId === user._id);
    if (!me) {
      return {
        status: "not_member" as const,
        playerCount: players.length,
        maxPlayers: MAX_PLAYERS,
      };
    }

    const totalBlanks = blankCount(room.puzzle);
    const isCoop = room.mode === "coop";
    const shared = room.mode !== "versus";

    const coopFilled = new Map<string, number>();
    if (shared) {
      for (let i = 0; i < 81; i++) {
        const owner = room.owners[i];
        if (owner && room.board[i] === room.solution[i]) {
          coopFilled.set(owner, (coopFilled.get(owner) ?? 0) + 1);
        }
      }
    }

    const board = shared ? room.board : me.board;

    return {
      status: "ok" as const,
      room: {
        _id: room._id,
        code: room.code,
        mode: room.mode,
        difficulty: room.difficulty,
        status: room.status,
        hostUserId: room.hostUserId,
        puzzle: room.puzzle,
        createdAt: room.createdAt,
        startedAt: room.startedAt,
        finishedAt: room.finishedAt,
        winnerPlayerId: room.winnerPlayerId,
        round: room.round,
        closedAt: room.closedAt,
        closedReason: room.closedReason,
      },
      me: { playerId: me._id, isHost: room.hostUserId === user._id },
      board,
      owners: shared ? room.owners : null,
      errors: wrongCells(board, room.solution),
      totalBlanks,
      players: players
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => ({
          _id: p._id,
          userId: p.userId,
          name: p.name,
          image: p.image,
          color: p.color,
          lastSeen: p.lastSeen,
          mistakes: p.mistakes,
          hints: p.hints ?? 0,
          points: p.points,
          finishedAt: p.finishedAt,
          cursor: isCoop && p._id !== me._id ? p.cursor : undefined,
          filled: shared
            ? (coopFilled.get(p._id) ?? 0)
            : correctCount(p.board, room.puzzle, room.solution),
        })),
    };
  },
});

/** Deletes rooms (and their players) older than the TTL. Run by cron. */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ROOM_TTL_MS;
    const stale = await ctx.db
      .query("rooms")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(100);
    for (const room of stale) {
      const players = await listPlayers(ctx, room._id);
      for (const p of players) await ctx.db.delete(p._id);
      await ctx.db.delete(room._id);
    }
  },
});

const MAX_IMPORT = 50;

/**
 * Attaches finished guest (browser-only) solo games to the signed-in user
 * as finished, rated solo rooms. Idempotent per game id.
 */
export const importGuestGames = mutation({
  args: {
    games: v.array(
      v.object({
        id: v.string(),
        difficulty,
        puzzle: v.string(),
        solution: v.string(),
        mistakes: v.number(),
        hints: v.number(),
        startedAt: v.number(),
        finishedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const imported: string[] = [];
    const now = Date.now();

    for (const g of args.games.slice(0, MAX_IMPORT)) {
      const valid =
        /^[0-9]{81}$/.test(g.puzzle) &&
        /^[1-9]{81}$/.test(g.solution) &&
        isCompleteGrid(g.solution) &&
        [...g.puzzle].every((c, i) => c === "0" || c === g.solution[i]) &&
        Number.isInteger(g.mistakes) &&
        g.mistakes >= 0 &&
        Number.isInteger(g.hints) &&
        g.hints >= 0 &&
        g.finishedAt > g.startedAt &&
        g.finishedAt <= now + 60_000;
      if (!valid) continue;

      const importKey = `${user._id}:${g.id}`;
      const existing = await ctx.db
        .query("rooms")
        .withIndex("by_importKey", (q) => q.eq("importKey", importKey))
        .unique();
      if (existing) {
        imported.push(g.id);
        continue;
      }

      let code = randomCode();
      while (await findRoomByCode(ctx, code)) code = randomCode();

      const roomId = await ctx.db.insert("rooms", {
        code,
        mode: "solo",
        difficulty: g.difficulty,
        status: "finished",
        hostUserId: user._id,
        puzzle: g.puzzle,
        solution: g.solution,
        board: g.solution,
        owners: new Array(81).fill(null),
        createdAt: g.finishedAt,
        startedAt: g.startedAt,
        finishedAt: g.finishedAt,
        round: 1,
        importKey,
      });
      const playerId = await ctx.db.insert("players", {
        roomId,
        userId: user._id,
        name: user.name,
        image: user.image ?? undefined,
        color: 0,
        joinedAt: g.startedAt,
        lastSeen: g.finishedAt,
        board: g.solution,
        mistakes: g.mistakes,
        hints: g.hints,
      });
      const owners = [...g.puzzle].map((c) => (c === "0" ? playerId : null));
      await ctx.db.patch(roomId, { owners });

      const room = (await ctx.db.get(roomId))!;
      const player = (await ctx.db.get(playerId))!;
      await awardRoom(ctx, room, [player]);
      imported.push(g.id);
    }

    return imported;
  },
});
