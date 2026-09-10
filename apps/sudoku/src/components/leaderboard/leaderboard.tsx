"use client";

import { useMemo, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { PlayerAvatar } from "~/components/player-avatar";
import { Quiet } from "~/components/room/room";
import { formatDuration, MODE_LABEL } from "~/lib/utils";
import { cn } from "~/lib/utils";
import {
  BASE_POINTS,
  HINT_PENALTY,
  PERFECT_MULTIPLIER,
} from "~/convex/lib/rating";

type Period = "all" | "week";
type SolveMode = "solo" | "coop" | "versus" | "daily";

const MODES: SolveMode[] = ["solo", "coop", "versus", "daily"];

function weekRangeLabel(start: number, end: number) {
  const fmt = (t: number) =>
    new Date(t).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(start)} – ${fmt(end - 1)}`;
}

function resetLabel(end: number) {
  const ms = Math.max(0, end - Date.now());
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 0) return `resets in ${d}d ${h}h`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `resets in ${h}h ${m}m`;
  return `resets in ${m}m`;
}

export function Leaderboard() {
  const { isLoading } = useConvexAuth();
  const [period, setPeriod] = useState<Period>("all");
  const board = useQuery(
    api.ratings.leaderboard,
    isLoading ? "skip" : { period },
  );

  const subtitle = useMemo(() => {
    if (!board) return "";
    const players = `${board.total} ${board.total === 1 ? "player" : "players"}`;
    const me = board.me
      ? ` · you're #${board.me.rank} with ${board.me.points.toLocaleString()} points`
      : "";
    if (board.period === "week") {
      return `${players} this week · ${weekRangeLabel(board.weekStart, board.weekEnd)} · ${resetLabel(board.weekEnd)}${me}`;
    }
    return `${players} rated${me}`;
  }, [board]);

  if (board === undefined) return <Quiet />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-medium tracking-tight">Leaderboard</h1>
        <div className="flex gap-1 rounded-full border border-border/60 bg-muted/40 p-1 text-sm w-fit">
          {(
            [
              { value: "all", label: "All time" },
              { value: "week", label: "This week" },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => setPeriod(t.value)}
              className={cn(
                "rounded-full px-4 py-1.5 transition-colors",
                period === t.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {board.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {period === "week"
            ? "Nobody has solved a puzzle yet this week. Be the first."
            : "Nobody has solved a puzzle yet."}
        </p>
      ) : (
        <ol className="divide-y divide-border/50 border-y border-border/50">
          {board.rows.map((r) => {
            const modesPlayed = MODES.filter((m) => r.byMode[m].solves > 0);
            return (
              <li
                key={r.userId}
                className={`flex items-center gap-3 py-3 text-sm ${
                  r.isMe ? "" : "text-muted-foreground"
                }`}
              >
                <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {r.rank}
                </span>
                <PlayerAvatar name={r.name} image={r.image} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {r.name}
                    {r.isMe ? " · you" : ""}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {r.solves} {r.solves === 1 ? "solve" : "solves"} ·{" "}
                    {r.perfectSolves} perfect
                    {modesPlayed.length > 0
                      ? ` · ${modesPlayed.map((m) => `${MODE_LABEL[m]} ${r.byMode[m].solves}`).join(" · ")}`
                      : ""}
                  </span>
                  {modesPlayed.length > 0 && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground/70">
                      {modesPlayed
                        .map((m) =>
                          r.byMode[m].bestMs !== null
                            ? `${MODE_LABEL[m]} best ${formatDuration(r.byMode[m].bestMs)}`
                            : null,
                        )
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="flex items-center gap-1.5 text-xs tabular-nums">
                    {r.bestTimeMs !== null ? (
                      <>
                        <span>{formatDuration(r.bestTimeMs)}</span>
                        {r.bestMode && (
                          <span className="rounded-full border border-border/60 px-1.5 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
                            {MODE_LABEL[r.bestMode]}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </span>
                  <span className="w-16 text-right font-medium tabular-nums">
                    {r.points.toLocaleString()}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
        <p>
          Score is rating points: every solve scores {BASE_POINTS.easy},{" "}
          {BASE_POINTS.medium}, {BASE_POINTS.hard} or {BASE_POINTS.expert}{" "}
          points by difficulty, scaled by speed against par (half to double), ×
          {PERFECT_MULTIPLIER} with no mistakes, −{HINT_PENALTY * 100}% per
          hint. Co-op splits by cells filled; versus pays the winner.
        </p>
        <p>
          Best is your fastest solve and the mode it happened in. All time ranks
          lifetime points; This week ranks points earned Monday 00:00 – Sunday
          23:59 UTC and resets every week.
        </p>
      </div>
    </div>
  );
}
