import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import { requireMember } from "./rooms";
import { setCell } from "./lib/sudoku";
import { buildHint } from "./lib/hint";
import { MAX_HINTS, MAX_MISTAKES } from "./lib/rating";
import { awardRoom } from "./ratings";
import { pauseClock, wakeClock, type Clock } from "./lib/clock";
import type { Doc, Id } from "./_generated/dataModel";
import {
  roomFinishedEvents,
  roomLostEvents,
  roomProps,
  track,
  versusEliminatedEvent,
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
 * even if a pause write got there first — unless the player has explicitly
 * held it, which only a `resume` lifts; finishing stops it for good either
 * way. Only solo rooms ever pause or hold, so elsewhere this just records
 * the activity. Rooms mid-round always have `startedAt`, and the clock falls
 * back to it anyway.
 */
function roomClock(room: Doc<"rooms">, at: number, finished: boolean) {
  const clock: Clock = { ...room, startedAt: room.startedAt ?? at };
  return finished ? pauseClock(clock, at) : wakeClock(clock, at);
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
      const mistakes = isWrong ? player.mistakes + 1 : player.mistakes;
      const lost = !solved && mistakes >= MAX_MISTAKES;
      await ctx.db.patch(room._id, {
        board,
        owners,
        ...roomClock(room, now, solved || lost),
        ...(solved || lost ? { status: "finished", finishedAt: now } : {}),
      });
      if (isWrong) {
        await ctx.db.patch(player._id, { mistakes });
      }
      if (solved) {
        await finishRoom(ctx, (await ctx.db.get(room._id))!);
      } else if (lost) {
        const finished = (await ctx.db.get(room._id))!;
        await track(
          ctx,
          roomLostEvents(finished, await roomPlayers(ctx, finished._id)),
        );
      }
      return;
    }

    // versus
    if (player.finishedAt || player.outAt) return;
    if (player.board[cell] === String(value)) return;
    const board = setCell(player.board, cell, value);
    const solved = board === room.solution;
    const mistakes = isWrong ? player.mistakes + 1 : player.mistakes;
    const out = !solved && mistakes >= MAX_MISTAKES;
    await ctx.db.patch(player._id, {
      board,
      mistakes,
      ...(solved ? { finishedAt: now } : {}),
      ...(out ? { outAt: now } : {}),
    });
    if (solved) {
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
      return;
    }
    if (!out) return;
    // Tracked the moment this player is out, not whenever the room finishes —
    // a winner emerging later would otherwise leave their own loss untracked.
    const players = await roomPlayers(ctx, room._id);
    await track(
      ctx,
      versusEliminatedEvent(room, player, players.length, mistakes, now),
    );
    // Elimination doesn't end the race for whoever's left — only stops the
    // room once every remaining player has finished or run out of mistakes.
    if (room.winnerPlayerId) return;
    const stillIn = players.some(
      (p) => p._id !== player._id && !p.finishedAt && !p.outAt,
    );
    if (!stillIn) {
      await ctx.db.patch(room._id, {
        status: "finished",
        finishedAt: now,
        ...roomClock(room, now, true),
      });
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
