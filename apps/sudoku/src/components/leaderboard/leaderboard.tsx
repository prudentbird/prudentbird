"use client";

import { useEffect, useMemo, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import type { Difficulty } from "~/convex/lib/sudoku";
import type { SolveMode } from "~/convex/ratings";
import { PlayerAvatar } from "~/components/player-avatar";
import { Quiet } from "~/components/room/room";
import { Choice } from "~/components/ui/choice";
import {
  BASE_POINTS,
  HINT_PENALTY,
  PERFECT_MULTIPLIER,
} from "~/convex/lib/rating";
import { DIFFICULTY_LABEL, MODE_LABEL, formatDuration } from "~/lib/utils";

type Period = "all" | "week";

const PERIODS: readonly { value: Period; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "week", label: "This week" },
];

const SOLVE_MODE_LABEL: Record<SolveMode, string> = {
  ...MODE_LABEL,
  daily: "Daily",
};

function fastest(best: {
  ms: number;
  mode: SolveMode;
  difficulty: Difficulty;
}) {
  return `${formatDuration(best.ms)} · ${SOLVE_MODE_LABEL[best.mode]} ${DIFFICULTY_LABEL[best.difficulty].toLowerCase()}`;
}

function resetsIn(at: number, now: number): string {
  const days = Math.max(0, Math.ceil((at - now) / (24 * 60 * 60_000)));
  if (days <= 1) return "resets tomorrow";
  return `resets in ${days} days`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC for the week containing `now` (client mirror of the
 * server's `weekStartUtc`, kept local so this file doesn't import Convex
 * server code into the client bundle). */
function weekStartUtc(now: number): number {
  const d = new Date(now);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return (
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
    sinceMonday * DAY_MS
  );
}

export function Leaderboard() {
  const { isLoading } = useConvexAuth();
  const [period, setPeriod] = useState<Period>("all");
  // Ticks so the weekly query re-runs at the Monday 00:00 UTC boundary while
  // the page stays open; Convex queries only refresh on data changes, not on
  // a timer, so the args need to change to force a refetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const anchorWeekStart = useMemo(() => weekStartUtc(now), [now]);
  const board = useQuery(
    api.ratings.leaderboard,
    isLoading ? "skip" : { period, anchorWeekStart },
  );

  const subtitle = board
    ? [
        `${board.total} ${board.total === 1 ? "player" : "players"} ${
          period === "week" ? "this week" : "rated"
        }`,
        period === "week" ? resetsIn(board.resetsAt, now) : null,
        board.me
          ? `you're #${board.me.rank} with ${board.me.points.toLocaleString()} points`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-medium tracking-tight">Leaderboard</h1>
        <Choice
          label="Period"
          value={period}
          onChange={setPeriod}
          options={PERIODS}
        />
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>

      {board === undefined ? (
        <Quiet />
      ) : board.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {period === "week"
            ? "Nobody has solved a puzzle this week yet."
            : "Nobody has solved a puzzle yet."}
        </p>
      ) : (
        <ol className="divide-y divide-border/50 border-y border-border/50">
          {board.rows.map((r) => (
            <li
              key={r.userId}
              className={`flex items-center gap-3 py-2.5 text-sm ${
                r.isMe ? "" : "text-muted-foreground"
              }`}
            >
              <span className="w-6 font-mono text-xs tabular-nums text-muted-foreground">
                {r.rank}
              </span>
              <PlayerAvatar name={r.name} image={r.image} size={24} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">
                  {r.name}
                  {r.isMe ? " · you" : ""}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {r.solves} {r.solves === 1 ? "solve" : "solves"} ·{" "}
                  {r.perfectSolves} perfect
                  {r.best ? (
                    <>
                      {" · "}
                      <span className="font-mono tabular-nums">
                        {fastest(r.best)}
                      </span>
                    </>
                  ) : null}
                </span>
              </span>
              <span className="w-16 text-right tabular-nums">
                {r.points.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Every solve scores {BASE_POINTS.easy}, {BASE_POINTS.medium},{" "}
        {BASE_POINTS.hard} or {BASE_POINTS.expert} points by difficulty, scaled
        by speed against par (half to double), ×{PERFECT_MULTIPLIER} with no
        mistakes, −{HINT_PENALTY * 100}% per hint. Co-op splits by cells filled;
        versus pays the winner. Fastest time is your quickest solve at any
        difficulty. The weekly board counts solves since Monday 00:00 UTC.
      </p>
    </div>
  );
}
