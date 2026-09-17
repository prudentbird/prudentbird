"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  clockElapsed,
  clockPaused,
  HEARTBEAT_MS,
  type Clock,
  type ClockAction,
} from "~/convex/lib/clock";
import { useNow } from "~/hooks/use-now";

export type GameClock = {
  /** Active milliseconds so far, frozen while paused. */
  elapsedMs: number;
  paused: boolean;
  /** True only for a pause the player asked for, which only they can lift. */
  pausedByPlayer: boolean;
  /** Undefined when this game can't be paused (co-op and versus rooms). */
  toggle?: () => void;
};

function focused(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

/**
 * Keeps a game's play clock in step with the tab.
 *
 * The clock is reopened once when a session mounts, stops the moment the tab
 * is hidden or loses focus, and starts again when it comes back — so a board
 * left open in a background tab stops counting. A pause the player asked for
 * is a `hold`, which refocusing and reloading both leave alone; only they can
 * lift it.
 *
 * `dispatch` writes the action wherever the clock lives (a Convex mutation
 * for the daily and rooms, local storage for guest solo), applying it with
 * `applyClock` from `convex/lib/clock.ts`.
 *
 * `onTick`, where a clock is cheap enough to write on a timer, records that
 * the tab is still here while the clock runs. That is what a later `reopen`
 * bills a crashed session up to, so supplying it tightens that repair from
 * "the player's last move" to "a heartbeat ago".
 */
export function useGameClock({
  clock,
  done,
  dispatch,
  onTick,
}: {
  clock: Clock | undefined;
  /** Finished or otherwise locked: the clock stops moving and stays put. */
  done: boolean;
  dispatch?: (action: ClockAction) => void;
  onTick?: () => void;
}): GameClock {
  // Once done, the clock is never "paused" from the UI's point of view —
  // solving stops it the same way pausing does (see pauseClock), so without
  // this a completed board would render forever behind the pause cover.
  const paused = !done && clock ? clockPaused(clock) : false;
  const held = paused && (clock?.pausedByPlayer ?? false);
  const canPause = dispatch !== undefined && !done;

  // Mirrored into refs so the listeners below can stay mounted for the whole
  // game rather than being torn down and re-added on every render.
  const heldRef = useRef(held);
  const dispatchRef = useRef(dispatch);
  const tickRef = useRef(onTick);
  useEffect(() => {
    heldRef.current = held;
    dispatchRef.current = dispatch;
    tickRef.current = onTick;
  });

  useEffect(() => {
    if (!canPause) return;
    const send = (action: ClockAction) => dispatchRef.current?.(action);

    send("reopen");
    if (!focused()) send("pause");

    const onAway = () => {
      if (focused()) return;
      send("pause");
    };
    const onBack = () => {
      if (!focused() || heldRef.current) return;
      send("resume");
    };

    // `blur` covers switching apps or windows with the tab still visible;
    // `visibilitychange` covers switching tabs and backgrounding on mobile,
    // where `pagehide` is the last event a killed tab gets.
    window.addEventListener("blur", onAway);
    window.addEventListener("pagehide", onAway);
    window.addEventListener("focus", onBack);
    document.addEventListener("visibilitychange", onAway);
    document.addEventListener("visibilitychange", onBack);
    return () => {
      window.removeEventListener("blur", onAway);
      window.removeEventListener("pagehide", onAway);
      window.removeEventListener("focus", onBack);
      document.removeEventListener("visibilitychange", onAway);
      document.removeEventListener("visibilitychange", onBack);
      // Leaving the board (navigating away, a rematch) stops the clock. This
      // is an auto pause, so the `reopen` on the next mount starts it again.
      send("pause");
    };
  }, [canPause]);

  // Only while the clock is actually running: a paused stretch has nothing
  // for a later `reopen` to repair.
  useEffect(() => {
    if (!canPause || !onTick || paused) return;
    const id = setInterval(() => tickRef.current?.(), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [canPause, onTick, paused]);

  const toggle = useCallback(() => {
    if (!canPause) return;
    heldRef.current = !paused;
    dispatchRef.current?.(paused ? "resume" : "hold");
  }, [canPause, paused]);

  // Only tick while the clock is actually moving: a paused or finished game
  // re-rendering every second is wasted work.
  const now = useNow(1000, !paused && !done);
  const elapsedMs = clock ? clockElapsed(clock, now) : 0;

  return {
    elapsedMs,
    paused,
    pausedByPlayer: held,
    toggle: canPause ? toggle : undefined,
  };
}
