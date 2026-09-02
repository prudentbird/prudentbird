"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import type { DailyView } from "~/lib/room-view";
import { setCell } from "~/convex/lib/sudoku";
import { formatDailyDate, todayUtc } from "~/lib/daily";
import { DIFFICULTY_LABEL, formatDuration } from "~/lib/utils";
import { useBecame } from "~/hooks/use-became";
import { Play } from "~/components/sudoku/play";
import { Timer } from "~/components/sudoku/timer";
import { Button } from "~/components/ui/button";
import { Overlay } from "~/components/ui/overlay";
import { Celebration } from "~/components/celebration";
import { GoogleButton } from "~/components/google-button";
import { Narrow, Quiet } from "~/components/room/room";

export function Daily({ date }: { date: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const view = useQuery(api.daily.get, isAuthenticated ? { date } : "skip");
  const start = useMutation(api.daily.start);
  const starting = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const needsStart =
    view !== undefined &&
    (view.status === "not_started" ||
      (view.status === "ok" && view.attempt === null));

  useEffect(() => {
    if (!needsStart || starting.current) return;
    starting.current = true;
    start({ date })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not start"),
      )
      .finally(() => {
        starting.current = false;
      });
  }, [needsStart, start, date]);

  if (isLoading) return <Quiet />;

  if (!isAuthenticated || view?.status === "unauthenticated") {
    return (
      <Narrow>
        <p className="text-sm text-muted-foreground">Daily challenge</p>
        <h1 className="text-2xl font-medium tracking-tight">
          {formatDailyDate(date)}
        </h1>
        <GoogleButton
          callbackURL={`/daily/${date}`}
          label="Sign in to play"
          className="mt-4 self-start"
        />
      </Narrow>
    );
  }

  if (error) {
    return (
      <Narrow>
        <p className="text-sm text-destructive">{error}</p>
      </Narrow>
    );
  }

  if (view === undefined || view.status !== "ok" || view.attempt === null) {
    return <Quiet label="Preparing the puzzle…" />;
  }

  return <DailyGame key={date} view={view} date={date} />;
}

function DailyGame({ view, date }: { view: DailyView; date: string }) {
  const { daily, attempt, totalBlanks } = view;
  if (!attempt) throw new Error("unreachable");
  const finished = attempt.finishedAt !== undefined;
  const justFinished = useBecame(finished);
  const [showResults, setShowResults] = useState(true);

  const place = useMutation(api.daily.place).withOptimisticUpdate(
    (store, args) => {
      const current = store.getQuery(api.daily.get, { date });
      if (!current || current.status !== "ok" || !current.attempt) return;
      store.setQuery(
        api.daily.get,
        { date },
        {
          ...current,
          attempt: {
            ...current.attempt,
            board: setCell(current.attempt.board, args.cell, args.value),
            errors: current.attempt.errors.filter((e) => e !== args.cell),
          },
        },
      );
    },
  );
  const hint = useMutation(api.daily.hint);

  const onPlace = useCallback(
    (cell: number, value: number) => place({ date, cell, value }),
    [place, date],
  );
  const onHint = useCallback(
    (cell: number | null) => hint({ date, cell }),
    [hint, date],
  );

  const topBar = (
    <div className="flex items-baseline justify-between gap-4 py-5">
      <div className="flex min-w-0 items-baseline gap-4">
        <Link
          href="/daily"
          className="shrink-0 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          ← Calendar
        </Link>
        <span className="truncate text-sm">
          {formatDailyDate(date)}
          <span className="text-muted-foreground">
            {" "}
            · {DIFFICULTY_LABEL[daily.difficulty]}
          </span>
        </span>
      </div>
      <Timer
        startedAt={attempt.startedAt}
        finishedAt={attempt.finishedAt}
        className="text-sm"
      />
    </div>
  );

  const aside = (
    <>
      <p className="text-sm text-muted-foreground">
        {attempt.filled} of {totalBlanks} filled · {attempt.mistakes}{" "}
        {attempt.mistakes === 1 ? "mistake" : "mistakes"}
        {attempt.hints
          ? ` · ${attempt.hints} ${attempt.hints === 1 ? "hint" : "hints"}`
          : ""}
      </p>
      <Leaderboard view={view} />
      {finished && !showResults ? (
        <button
          type="button"
          onClick={() => setShowResults(true)}
          className="cursor-pointer self-start text-sm underline underline-offset-2"
        >
          Show results
        </button>
      ) : null}
    </>
  );

  return (
    <>
      {justFinished ? <Celebration intensity="big" /> : null}
      <Play
        puzzle={daily.puzzle}
        board={attempt.board}
        errors={attempt.errors}
        locked={finished}
        onPlace={onPlace}
        onHint={onHint}
        topBar={topBar}
        aside={aside}
        overlay={
          finished && showResults ? (
            <DailyResults
              view={view}
              date={date}
              onViewBoard={() => setShowResults(false)}
            />
          ) : null
        }
      />
    </>
  );
}

function Leaderboard({ view }: { view: DailyView }) {
  const { leaderboard, finishedCount, playing } = view;
  return (
    <section>
      <h2 className="mb-1 flex items-baseline justify-between text-sm font-medium">
        Leaderboard
        <span className="text-xs font-normal text-muted-foreground">
          {finishedCount} finished · {playing} playing
        </span>
      </h2>
      {leaderboard.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          Nobody has finished yet.
        </p>
      ) : (
        <ol className="divide-y divide-border/50">
          {leaderboard.map((row) => (
            <li
              key={row.userId}
              className={`flex items-center gap-3 py-2 text-sm ${
                row.isMe ? "" : "text-muted-foreground"
              }`}
            >
              <span className="w-4 font-mono text-xs text-muted-foreground">
                {row.rank}
              </span>
              <span className="flex-1 truncate">
                {row.name}
                {row.isMe ? " · you" : ""}
              </span>
              <span className="font-mono text-xs tabular-nums">
                {formatDuration(row.elapsedMs)} · {row.mistakes}✕
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DailyResults({
  view,
  date,
  onViewBoard,
}: {
  view: DailyView;
  date: string;
  onViewBoard: () => void;
}) {
  const { daily, attempt, finishedCount } = view;
  const [copied, setCopied] = useState(false);
  if (!attempt) return null;
  const elapsed = attempt.elapsedMs ?? 0;
  const isToday = date === todayUtc();

  const share = async () => {
    const text = `Sudoku daily ${date} (${DIFFICULTY_LABEL[daily.difficulty]}) · ${formatDuration(elapsed)} · ${attempt.mistakes} ${
      attempt.mistakes === 1 ? "mistake" : "mistakes"
    }${attempt.rank ? ` · #${attempt.rank}` : ""}\n${window.location.origin}/daily/${date}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // user cancelled
    }
  };

  return (
    <Overlay label="Daily results" onDismiss={onViewBoard}>
      <div className="flex flex-col gap-8 p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {formatDailyDate(date)} · {DIFFICULTY_LABEL[daily.difficulty]}
          </p>
          <h2 className="text-3xl font-medium tracking-tight">
            {attempt.rank === 1 ? "Fastest today." : "Done."}
          </h2>
          <p className="font-mono text-2xl tabular-nums">
            {formatDuration(elapsed)}
          </p>
          {attempt.points ? (
            <p className="text-sm text-muted-foreground">
              +{attempt.points.toLocaleString()} points
            </p>
          ) : null}
        </div>

        <dl className="grid grid-cols-3 divide-x divide-border/50 border-y border-border/50 py-3 text-sm">
          <div className="pr-4">
            <dt className="text-xs text-muted-foreground">Rank</dt>
            <dd className="tabular-nums">
              {attempt.rank ? `#${attempt.rank} of ${finishedCount}` : "—"}
            </dd>
          </div>
          <div className="px-4">
            <dt className="text-xs text-muted-foreground">Mistakes</dt>
            <dd className="tabular-nums">{attempt.mistakes}</dd>
          </div>
          <div className="pl-4">
            <dt className="text-xs text-muted-foreground">Hints</dt>
            <dd className="tabular-nums">{attempt.hints}</dd>
          </div>
        </dl>

        <div className="flex items-center gap-2">
          <Button onClick={share}>{copied ? "Copied" : "Share result"}</Button>
          <Button asChild variant="secondary">
            <Link href="/daily">Back to calendar</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {isToday
            ? "A new puzzle arrives at midnight UTC."
            : "Every past day is still playable from the calendar."}
        </p>
      </div>
    </Overlay>
  );
}
