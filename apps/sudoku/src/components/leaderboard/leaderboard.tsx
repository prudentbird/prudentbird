"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { PlayerAvatar } from "~/components/player-avatar";
import { Quiet } from "~/components/room/room";
import {
  BASE_POINTS,
  HINT_PENALTY,
  PERFECT_MULTIPLIER,
} from "~/convex/lib/rating";

export function Leaderboard() {
  const { isLoading } = useConvexAuth();
  const board = useQuery(api.ratings.leaderboard, isLoading ? "skip" : {});

  if (board === undefined) return <Quiet />;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-medium tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          {board.total} {board.total === 1 ? "player" : "players"} rated
          {board.me
            ? ` · you're #${board.me.rank} with ${board.me.points.toLocaleString()} points`
            : ""}
        </p>
      </div>

      {board.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nobody has solved a puzzle yet.
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
              <span className="min-w-0 flex-1 truncate">
                {r.name}
                {r.isMe ? " · you" : ""}
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {r.solves} {r.solves === 1 ? "solve" : "solves"} ·{" "}
                {r.perfectSolves} perfect
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
        versus pays the winner.
      </p>
    </div>
  );
}
