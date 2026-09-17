/**
 * The play clock behind every timed game (daily attempts, rooms, guest solo).
 *
 * A game only accrues *active* time. Closed stretches are summed into
 * `activeMs`; `runningSince` marks the open one, and is cleared while paused.
 * The client pauses the moment its tab is hidden or blurred, so a board left
 * open overnight stops counting instead of reporting a 29-hour solve.
 */
export type Clock = {
  /** Wall-clock start. Kept for display and ordering, never for elapsed. */
  startedAt: number;
  /** Active time from stretches that have already been closed. */
  activeMs?: number;
  /** Start of the open stretch, or undefined while paused. */
  runningSince?: number;
  /** Last action the server actually saw. Bounds a stretch left dangling. */
  lastActiveAt?: number;
  /** Set once the game ends. The clock never reads past it. */
  finishedAt?: number;
  /**
   * The player pressed pause, as opposed to their tab losing focus. Only they
   * lift it, so it outlives a reload rather than restarting under them.
   */
  pausedByPlayer?: boolean;
};

export type ClockPatch = {
  activeMs: number;
  runningSince: number | undefined;
  lastActiveAt: number;
  pausedByPlayer: boolean;
};

/** How often a clock with a pinger records that its tab is still alive. */
export const HEARTBEAT_MS = 15_000;

/**
 * Games that predate the clock carry neither field, and ran unpaused from
 * `startedAt` — which is exactly what an open stretch starting there means.
 */
function normalize(clock: Clock): { activeMs: number; runningSince?: number } {
  if (clock.activeMs === undefined && clock.runningSince === undefined) {
    return { activeMs: 0, runningSince: clock.startedAt };
  }
  return { activeMs: clock.activeMs ?? 0, runningSince: clock.runningSince };
}

/** Active milliseconds as of `now`. Frozen while paused, and once finished. */
export function clockElapsed(clock: Clock, now: number): number {
  const { activeMs, runningSince } = normalize(clock);
  if (runningSince === undefined) return activeMs;
  const end =
    clock.finishedAt === undefined ? now : Math.min(now, clock.finishedAt);
  return activeMs + Math.max(0, end - runningSince);
}

export function clockPaused(clock: Clock): boolean {
  return normalize(clock).runningSince === undefined;
}

/** Closes the open stretch. Idempotent when already paused. */
export function pauseClock(
  clock: Clock,
  at: number,
  byPlayer = false,
): ClockPatch {
  return {
    activeMs: clockElapsed(clock, at),
    runningSince: undefined,
    lastActiveAt: at,
    pausedByPlayer: byPlayer || (clock.pausedByPlayer ?? false),
  };
}

/** Opens a stretch, clearing any hold the player put on it. */
export function resumeClock(clock: Clock, at: number): ClockPatch {
  const { activeMs, runningSince } = normalize(clock);
  return {
    activeMs,
    runningSince: runningSince ?? at,
    lastActiveAt: at,
    pausedByPlayer: false,
  };
}

/**
 * First clock action of a browser session. A stretch still open here belongs
 * to a session that never got to pause (crash, killed tab, closed laptop), so
 * it is billed up to the last activity actually recorded rather than up to
 * `at` — the clock charges for time it saw, and nothing beyond.
 *
 * Nothing is added on top to guess at how much longer the session really ran.
 * Guessing high charges a player for minutes they may not have spent, and
 * guessing at all only ever defended against a player shaving off their own
 * thinking time — which `hold` lets them do in one click anyway.
 *
 * How close this lands to the truth is therefore down to how recent
 * `lastActiveAt` is: within a heartbeat where something pings while the tab is
 * merely open, or the last move where nothing does.
 *
 * A clock the player held stays held — they lift it by hand.
 */
export function reopenClock(clock: Clock, at: number): ClockPatch {
  const { activeMs, runningSince } = normalize(clock);
  const held = clock.pausedByPlayer ?? false;
  if (runningSince === undefined) {
    return {
      activeMs,
      runningSince: held ? undefined : at,
      lastActiveAt: at,
      pausedByPlayer: held,
    };
  }
  const billedUntil = Math.min(at, clock.lastActiveAt ?? runningSince);
  return {
    activeMs: activeMs + Math.max(0, billedUntil - runningSince),
    runningSince: held ? undefined : at,
    lastActiveAt: at,
    pausedByPlayer: held,
  };
}

/**
 * `pause` is the tab losing focus; `hold` is the player pressing pause, which
 * a later `reopen` respects. `resume` lifts either.
 */
export const CLOCK_ACTIONS = ["pause", "hold", "resume", "reopen"] as const;
export type ClockAction = (typeof CLOCK_ACTIONS)[number];

export function applyClock(
  clock: Clock,
  action: ClockAction,
  at: number,
): ClockPatch {
  if (action === "pause") return pauseClock(clock, at);
  if (action === "hold") return pauseClock(clock, at, true);
  if (action === "resume") return resumeClock(clock, at);
  return reopenClock(clock, at);
}

/** True when applying `patch` would leave the clock exactly as it is. */
export function clockUnchanged(
  clock: Pick<Clock, "activeMs" | "runningSince" | "pausedByPlayer">,
  patch: ClockPatch,
): boolean {
  return (
    patch.activeMs === (clock.activeMs ?? 0) &&
    patch.runningSince === clock.runningSince &&
    patch.pausedByPlayer === (clock.pausedByPlayer ?? false)
  );
}
