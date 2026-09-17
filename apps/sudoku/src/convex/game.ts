import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import { requireMember } from "./rooms";
import { setCell } from "./lib/sudoku";
import { buildHint } from "./lib/hint";
import { MAX_HINTS } from "./lib/rating";
import { awardRoom } from "./ratings";
import { pauseClock, resumeClock, type Clock } from "./lib/clock";
import type { Doc, Id } from "./_generated/dataModel";
import {
  roomFinishedEvents,
  roomProps,
  track,
  versusLateFinishEvent,
} from "./analytics";

async function roomPlayers(ctx: MutationCtx, roomId: Id<"rooms">) {
  return ctx.db
    .query("players")
    .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
    .collect();
}

/**
 * A move proves the player is at the board, so the room's clock runs again
 * even if a pause write got there first; finishing stops it for good. Only
 * solo rooms ever pause, so elsewhere this just records the activity. Rooms
 * mid-round always have `startedAt`, and the clock falls back to it anyway.
 */
function roomClock(room: Doc<"rooms">, at: number, finished: boolean) {
  const clock: Clock = { ...room, startedAt: room.startedAt ?? at };
  return finished ? pauseClock(clock, at) : resumeClock(clock, at);
}

async function finishRoom(ctx: MutationCtx, room: Doc<"rooms">) {
  const players = await roomPlayers(ctx, room._id);
  await awardRoom(ctx, room, players);
  await track(ctx, roomFinishedEvents(room, players));
}

/**
 * Places a digit (1-9) or clears a cell (0). Validates against the solution
 * server-side so the answer never has to be shipped to the browser.
 */
export const place = mutation({
  args: {
    roomId: v.id("rooms"),
    cell: v.number(),
    value: v.number(),
  },
  handler: async (ctx, args) => {
    const { room, player } = await requireMember(ctx, args.roomId);
    const { cell, value } = args;

    if (room.status !== "playing") return;
    if (!Number.isInteger(cell) || cell < 0 || cell > 80) {
      throw new Error("Invalid cell");
    }
    if (!Number.isInteger(value) || value < 0 || value > 9) {
      throw new Error("Invalid value");
    }
    if (room.puzzle[cell] !== "0") return; // given cell

    const now = Date.now();
    const correctChar = room.solution[cell];
    const isWrong = value !== 0 && String(value) !== correctChar;

    if (room.mode !== "versus") {
      if (room.board[cell] === String(value)) return; // no-op
      const board = setCell(room.board, cell, value);
      const owners = room.owners.slice();
      owners[cell] = value === 0 ? null : player._id;
      const solved = board === room.solution;
      await ctx.db.patch(room._id, {
        board,
        owners,
        ...roomClock(room, now, solved),
        ...(solved ? { status: "finished", finishedAt: now } : {}),
      });
      if (isWrong) {
        await ctx.db.patch(player._id, { mistakes: player.mistakes + 1 });
      }
      if (solved) await finishRoom(ctx, (await ctx.db.get(room._id))!);
      return;
    }

    // versus
    if (player.finishedAt) return;
    if (player.board[cell] === String(value)) return;
    const board = setCell(player.board, cell, value);
    const solved = board === room.solution;
    await ctx.db.patch(player._id, {
      board,
      mistakes: isWrong ? player.mistakes + 1 : player.mistakes,
      ...(solved ? { finishedAt: now } : {}),
    });
    if (!solved) return;
    if (!room.winnerPlayerId) {
      await ctx.db.patch(room._id, {
        winnerPlayerId: player._id,
        status: "finished",
        finishedAt: now,
        ...roomClock(room, now, true),
      });
      await finishRoom(ctx, (await ctx.db.get(room._id))!);
    } else {
      const players = await roomPlayers(ctx, room._id);
      await track(
        ctx,
        versusLateFinishEvent(
          room,
          (await ctx.db.get(player._id))!,
          players.length,
          now,
        ),
      );
    }
  },
});

/**
 * Builds the walkthrough for one cell. Not in versus, where it would be a
 * free win. Counts towards the room's shared hint tally, capped at MAX_HINTS
 * for the whole game (not per player). The digit itself is placed through
 * `place` once the player reaches the end of the walkthrough.
 */
export const hint = mutation({
  args: { roomId: v.id("rooms"), cell: v.union(v.number(), v.null()) },
  handler: async (ctx, args) => {
    const { room, player } = await requireMember(ctx, args.roomId);
    if (room.status !== "playing" || room.mode === "versus") return null;
    if ((room.hints ?? 0) >= MAX_HINTS) return null;

    const open: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (room.puzzle[i] === "0" && room.board[i] !== room.solution[i]) {
        open.push(i);
      }
    }
    const preferred =
      args.cell !== null && Number.isInteger(args.cell) ? args.cell : null;
    const hint = buildHint(room.board, room.solution, open, preferred);
    if (!hint) return null;

    await ctx.db.patch(room._id, {
      hints: (room.hints ?? 0) + 1,
      ...roomClock(room, Date.now(), false),
    });
    await ctx.db.patch(player._id, { hints: (player.hints ?? 0) + 1 });
    await track(ctx, {
      distinctId: player.userId,
      event: "hint_used",
      properties: roomProps(room),
    });
    return hint;
  },
});

/** Co-op live cursor. Throttled on the client. */
export const setCursor = mutation({
  args: { roomId: v.id("rooms"), cell: v.union(v.number(), v.null()) },
  handler: async (ctx, args) => {
    const { player } = await requireMember(ctx, args.roomId);
    const cursor = args.cell === null ? undefined : args.cell;
    if (player.cursor === cursor) return;
    await ctx.db.patch(player._id, { cursor });
  },
});

export const heartbeat = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const { player } = await requireMember(ctx, args.roomId);
    await ctx.db.patch(player._id, { lastSeen: Date.now() });
  },
});
