"use client";

import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import type { Difficulty } from "~/convex/lib/sudoku";
import { GoogleButton } from "~/components/google-button";
import { Narrow, Quiet } from "~/components/room/room";
import { DIFFICULTY_LABEL, MODE_LABEL, formatDuration } from "~/lib/utils";

const DIFFICULTIES = Object.keys(DIFFICULTY_LABEL) as Difficulty[];
const MODES = ["solo", "coop", "versus"] as const;

function ms(value: number | null): string {
  return value === null ? "–" : formatDuration(value);
}

function pct(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}

function n(value: number): string {
  return value.toLocaleString();
}

export function Stats() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const stats = useQuery(api.stats.me, isAuthenticated ? {} : "skip");

  if (isLoading) return <Quiet />;
  if (!isAuthenticated) {
    return (
      <Narrow>
        <h1 className="text-2xl font-medium tracking-tight">Stats</h1>
        <GoogleButton
          callbackURL="/stats"
          label="Sign in to see your stats"
          className="mt-4 self-start"
        />
      </Narrow>
    );
  }
  if (stats === undefined) return <Quiet />;
  if (stats === null) return <Quiet label="Nothing yet." />;

  const { rating, games, byMode, byDifficulty, daily } = stats;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-10 px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-medium tracking-tight">Stats</h1>
        <p className="text-sm text-muted-foreground">
          {rating ? (
            <>
              {n(rating.points)} points ·{" "}
              <Link
                href="/leaderboard"
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                #{rating.rank} of {rating.total}
              </Link>
            </>
          ) : (
            "No rating yet. Solve a puzzle to get on the board."
          )}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">Overview</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
          <Cell label="Games" value={n(games.played)} />
          <Cell label="Won" value={n(games.won)} />
          <Cell label="Win rate" value={pct(games.winRate)} />
          <Cell label="Perfect wins" value={n(games.perfect)} />
          <Cell label="Best time" value={ms(games.bestMs)} mono />
          <Cell label="Average" value={ms(games.avgMs)} mono />
          <Cell label="Mistakes" value={n(games.mistakes)} />
          <Cell label="Hints" value={n(games.hints)} />
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Daily</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
          <Cell
            label="Solved"
            value={`${n(daily.solved)} of ${n(daily.played)}`}
          />
          <Cell label="Streak" value={days(daily.streak)} />
          <Cell label="Best streak" value={days(daily.bestStreak)} />
          <Cell label="Perfect" value={n(daily.perfect)} />
          <Cell label="Best time" value={ms(daily.bestMs)} mono />
          <Cell label="Average" value={ms(daily.avgMs)} mono />
          <Cell label="Mistakes" value={n(daily.mistakes)} />
          <Cell label="Points" value={n(daily.points)} />
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">By difficulty</h2>
        <Table
          rows={DIFFICULTIES.map((d) => ({
            key: d,
            label: DIFFICULTY_LABEL[d],
            ...byDifficulty[d],
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">By mode</h2>
        <Table
          rows={MODES.map((m) => ({
            key: m,
            label: MODE_LABEL[m],
            ...byMode[m],
          }))}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Won means solved in solo and co-op, and first to finish in versus.
          Perfect is a win with no mistakes.
        </p>
      </section>
    </div>
  );
}

function days(count: number) {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

function Cell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

type Row = {
  key: string;
  label: string;
  played: number;
  won: number;
  winRate: number | null;
  perfect: number;
  points: number;
  bestMs: number | null;
  avgMs: number | null;
};

function Table({ rows }: { rows: Row[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-1.5 text-left font-normal"></th>
            <Th>Played</Th>
            <Th>Won</Th>
            <Th>Win rate</Th>
            <Th>Perfect</Th>
            <Th>Best</Th>
            <Th>Average</Th>
            <Th>Points</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50 border-y border-border/50">
          {rows.map((r) => (
            <tr key={r.key} className={r.played ? "" : "text-muted-foreground"}>
              <td className="py-2 pr-3">{r.label}</td>
              <Td>{n(r.played)}</Td>
              <Td>{n(r.won)}</Td>
              <Td>{pct(r.winRate)}</Td>
              <Td>{n(r.perfect)}</Td>
              <Td mono>{ms(r.bestMs)}</Td>
              <Td mono>{ms(r.avgMs)}</Td>
              <Td>{n(r.points)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-1.5 pl-3 text-right font-normal">{children}</th>;
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      className={`py-2 pl-3 text-right tabular-nums ${mono ? "font-mono" : ""}`}
    >
      {children}
    </td>
  );
}
