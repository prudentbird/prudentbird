import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import { requireMember } from "./rooms";
import { setCell } from "./lib/sudoku";
import { awardRoom } from "./ratings";
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
 * Reveals the correct digit for a cell. Not in versus, where it would be
 * a free win. Counts towards the player's hint tally.
 */
export const hint = mutation({
  args: { roomId: v.id("rooms"), cell: v.union(v.number(), v.null()) },
  handler: async (ctx, args) => {
    const { room, player } = await requireMember(ctx, args.roomId);
    if (room.status !== "playing" || room.mode === "versus") return null;

    let cell = args.cell;
    const isOpen = (i: number) =>
      room.puzzle[i] === "0" && room.board[i] !== room.solution[i];
    if (cell === null || !Number.isInteger(cell) || !isOpen(cell)) {
      const open: number[] = [];
      for (let i = 0; i < 81; i++) if (isOpen(i)) open.push(i);
      if (open.length === 0) return null;
      cell = open[Math.floor(Math.random() * open.length)]!;
    }

    const value = room.solution.charCodeAt(cell) - 48;
    const board = setCell(room.board, cell, value);
    const owners = room.owners.slice();
    owners[cell] = player._id;
    const solved = board === room.solution;
    const now = Date.now();
    await ctx.db.patch(room._id, {
      board,
      owners,
      ...(solved ? { status: "finished", finishedAt: now } : {}),
    });
    await ctx.db.patch(player._id, { hints: (player.hints ?? 0) + 1 });
    await track(ctx, {
      distinctId: player.userId,
      event: "hint_used",
      properties: roomProps(room),
    });
    if (solved) await finishRoom(ctx, (await ctx.db.get(room._id))!);
    return cell;
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
