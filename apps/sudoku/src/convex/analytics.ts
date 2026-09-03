import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, type MutationCtx } from "./_generated/server";
import { blankCount } from "./lib/sudoku";
import { dailyAward, roomAwards } from "./ratings";

/** Mutations can't fetch, so `track` schedules an action that posts a batch. */
export type AnalyticsEvent = {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
};

const DEFAULT_HOST = "https://us.i.posthog.com";

export async function track(
  ctx: MutationCtx,
  events: AnalyticsEvent | AnalyticsEvent[],
) {
  if (!process.env.POSTHOG_KEY) return;
  const list = Array.isArray(events) ? events : [events];
  if (list.length === 0) return;
  const timestamp = Date.now();
  await ctx.scheduler.runAfter(0, internal.analytics.capture, {
    events: list.map((e) => ({ ...e, timestamp })),
  });
}

export const capture = internalAction({
  args: {
    events: v.array(
      v.object({
        distinctId: v.string(),
        event: v.string(),
        properties: v.optional(v.record(v.string(), v.any())),
        timestamp: v.number(),
      }),
    ),
  },
  handler: async (_ctx, { events }) => {
    const key = process.env.POSTHOG_KEY;
    if (!key) return;
    const host = (process.env.POSTHOG_HOST ?? DEFAULT_HOST).replace(/\/$/, "");
    const res = await fetch(`${host}/batch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        batch: events.map((e) => ({
          event: e.event,
          distinct_id: e.distinctId,
          timestamp: new Date(e.timestamp).toISOString(),
          properties: { $lib: "convex", source: "server", ...e.properties },
        })),
      }),
    });
    if (!res.ok) {
      throw new Error(
        `PostHog capture failed: ${res.status} ${await res.text()}`,
      );
    }
  },
});

export function roomProps(room: Doc<"rooms">) {
  return {
    mode: room.mode,
    difficulty: room.difficulty,
    room_id: room._id,
    room_code: room.code,
    round: room.round,
    is_guest: false,
  };
}

export function roomStartedEvents(
  room: Doc<"rooms">,
  players: Doc<"players">[],
): AnalyticsEvent[] {
  const props = { ...roomProps(room), player_count: players.length };
  return players.map((p) => ({
    distinctId: p.userId,
    event: "game_started",
    properties: props,
  }));
}

/** `game_completed` for everyone credited (winner only in versus) plus `room_finished`. */
export function roomFinishedEvents(
  room: Doc<"rooms">,
  players: Doc<"players">[],
): AnalyticsEvent[] {
  if (!room.startedAt || !room.finishedAt) return [];
  const durationMs = room.finishedAt - room.startedAt;
  const base = { ...roomProps(room), player_count: players.length };
  const points = new Map(
    roomAwards(room, players).map((a) => [a.player._id, a.points]),
  );
  const events: AnalyticsEvent[] = [];
  for (const p of players) {
    if (room.mode === "versus" && p._id !== room.winnerPlayerId) continue;
    events.push({
      distinctId: p.userId,
      event: "game_completed",
      properties: {
        ...base,
        duration_ms: durationMs,
        mistakes: p.mistakes,
        hints: p.hints ?? 0,
        points: points.get(p._id) ?? 0,
        ...(room.mode === "versus" ? { won: true } : {}),
      },
    });
  }
  const winner = players.find((p) => p._id === room.winnerPlayerId);
  events.push({
    distinctId: room.hostUserId,
    event: "room_finished",
    properties: {
      ...base,
      duration_ms: durationMs,
      ...(winner ? { winner_user_id: winner.userId } : {}),
    },
  });
  return events;
}

export function versusLateFinishEvent(
  room: Doc<"rooms">,
  player: Doc<"players">,
  playerCount: number,
  finishedAt: number,
): AnalyticsEvent {
  return {
    distinctId: player.userId,
    event: "game_completed",
    properties: {
      ...roomProps(room),
      player_count: playerCount,
      duration_ms: room.startedAt ? finishedAt - room.startedAt : 0,
      mistakes: player.mistakes,
      hints: player.hints ?? 0,
      points: 0,
      won: false,
    },
  };
}

export function roomAbandonedEvents(
  room: Doc<"rooms">,
  players: Doc<"players">[],
  closedAt: number,
): AnalyticsEvent[] {
  if (room.status !== "playing" || !room.startedAt) return [];
  const totalBlanks = blankCount(room.puzzle);
  const durationMs = closedAt - room.startedAt;
  return players.map((p) => {
    const board = room.mode === "versus" ? p.board : room.board;
    let filled = 0;
    for (let i = 0; i < 81; i++) {
      if (room.puzzle[i] === "0" && board[i] === room.solution[i]) filled++;
    }
    return {
      distinctId: p.userId,
      event: "game_abandoned",
      properties: {
        ...roomProps(room),
        player_count: players.length,
        duration_ms: durationMs,
        filled,
        total_blanks: totalBlanks,
      },
    };
  });
}

export function dailyProps(daily: Doc<"dailies">) {
  return {
    mode: "daily" as const,
    difficulty: daily.difficulty,
    date: daily.date,
    is_guest: false,
  };
}

export function dailyCompletedEvent(
  daily: Doc<"dailies">,
  attempt: Doc<"dailyAttempts">,
): AnalyticsEvent {
  return {
    distinctId: attempt.userId,
    event: "game_completed",
    properties: {
      ...dailyProps(daily),
      duration_ms: attempt.elapsedMs ?? 0,
      mistakes: attempt.mistakes,
      hints: attempt.hints,
      points: dailyAward(daily, attempt),
    },
  };
}
