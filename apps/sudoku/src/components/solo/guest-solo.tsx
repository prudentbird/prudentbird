"use client";

import { useAuth } from "~/hooks/use-auth";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  DIFFICULTIES,
  setCell,
  wrongCells,
  type Difficulty,
} from "~/convex/lib/sudoku";
import { buildHint } from "~/convex/lib/hint";
import { applyEliminations } from "~/convex/lib/hint_engine";
import { MAX_HINTS, MAX_MISTAKES } from "~/convex/lib/rating";
import {
  dispatchLocalClock,
  newLocalGame,
  pushHistory,
  soloStore,
  tickLocalClock,
  type LocalGame,
} from "~/lib/local-solo";
import {
  clockElapsed,
  pauseClock,
  pauseForHint,
  finishHintClock,
  resumeClock,
} from "~/convex/lib/clock";
import { DIFFICULTY_LABEL, formatDuration } from "~/lib/utils";
import { track } from "~/lib/analytics";
import { useBecame } from "~/hooks/use-became";
import { useGameClock } from "~/hooks/use-game-clock";
import { useMounted } from "~/hooks/use-mounted";
import { Play } from "~/components/sudoku/play";
import { Timer } from "~/components/sudoku/timer";
import { Button } from "~/components/ui/button";
import { Choice } from "~/components/ui/choice";
import { Overlay } from "~/components/ui/overlay";
import { Celebration } from "~/components/celebration";
import { GoogleButton } from "~/components/google-button";
import { Quiet } from "~/components/room/room";

function isDifficulty(value: string | null): value is Difficulty {
  return value !== null && (DIFFICULTIES as readonly string[]).includes(value);
}

function startGame(difficulty: Difficulty, isGuest: boolean) {
  const current = soloStore.get();
  if (current && current.finishedAt === undefined) {
    let filled = 0;
    let totalBlanks = 0;
    for (let i = 0; i < 81; i++) {
      if (current.puzzle[i] !== "0") continue;
      totalBlanks++;
      if (current.board[i] === current.solution[i]) filled++;
    }
    track("game_abandoned", {
      mode: "solo",
      difficulty: current.difficulty,
      is_guest: isGuest,
      duration_ms: clockElapsed(current, Date.now()),
      filled,
      total_blanks: totalBlanks,
    });
  }
  const game = newLocalGame(difficulty);
  track("game_started", { mode: "solo", difficulty, is_guest: isGuest });
  soloStore.set(game);
}

export function GuestSolo() {
  return (
    <Suspense fallback={<Quiet />}>
      <GuestSoloInner />
    </Suspense>
  );
}

function GuestSoloInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const isGuest = !isAuthenticated;
  const requested = params.get("new");
  const game = useSyncExternalStore(
    soloStore.subscribe,
    soloStore.get,
    soloStore.getServer,
  );
  const mounted = useMounted();

  // `?new=<difficulty>` starts a fresh game; otherwise resume or start medium.
  useEffect(() => {
    if (isLoading) return;
    if (isDifficulty(requested)) {
      startGame(requested, isGuest);
      router.replace("/solo");
    } else if (!soloStore.get()) {
      startGame("medium", isGuest);
    }
  }, [requested, router, isGuest, isLoading]);

  if (!mounted || !game) return <Quiet />;
  return (
    <SoloGame
      key={game.startedAt}
      game={game}
      onChange={(g) => {
        if (g.finishedAt) {
          const won = g.board === g.solution;
          // Only a real solve is worth attaching to the account later; a
          // loss would otherwise get imported as if the board were solved.
          if (won) pushHistory(g);
          track(won ? "game_completed" : "game_over", {
            mode: "solo",
            difficulty: g.difficulty,
            is_guest: isGuest,
            duration_ms: clockElapsed(g, g.finishedAt),
            mistakes: g.mistakes,
            hints: g.hints,
          });
        }
        soloStore.set(g);
      }}
      onNew={(d) => startGame(d, isGuest)}
    />
  );
}

function SoloGame({
  game,
  onChange,
  onNew,
}: {
  game: LocalGame;
  onChange: (game: LocalGame) => void;
  onNew: (difficulty: Difficulty) => void;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const finished = game.finishedAt !== undefined;
  const won = finished && game.board === game.solution;
  const justFinished = useBecame(finished);
  const clock = useGameClock({
    clock: game,
    done: finished,
    dispatch: dispatchLocalClock,
    onTick: tickLocalClock,
  });
  const [showResults, setShowResults] = useState(true);
  const [nextDifficulty, setNextDifficulty] = useState<Difficulty>(
    game.difficulty,
  );

  const errors = useMemo(
    () => wrongCells(game.board, game.solution),
    [game.board, game.solution],
  );
  const filled = useMemo(() => {
    let n = 0;
    for (let i = 0; i < 81; i++) {
      if (game.puzzle[i] === "0" && game.board[i] === game.solution[i]) n++;
    }
    return n;
  }, [game.puzzle, game.board, game.solution]);
  const totalBlanks = useMemo(
    () => [...game.puzzle].filter((c) => c === "0").length,
    [game.puzzle],
  );

  const onPlace = useCallback(
    (cell: number, value: number) => {
      if (game.finishedAt || game.puzzle[cell] !== "0") return;
      if (game.board[cell] === String(value)) return;
      const board = setCell(game.board, cell, value);
      const wrong = value !== 0 && String(value) !== game.solution[cell];
      const solved = board === game.solution;
      const mistakes = wrong ? game.mistakes + 1 : game.mistakes;
      const lost = !solved && mistakes >= MAX_MISTAKES;
      const now = Date.now();
      onChange({
        ...game,
        board,
        mistakes,
        candidateEliminations: undefined,
        pendingHint: undefined,
        // A move means the player is at the board, so the clock runs again;
        // finishing stops it for good either way.
        ...(solved || lost ? pauseClock(game, now) : resumeClock(game, now)),
        ...(solved || lost ? { finishedAt: now } : {}),
      });
    },
    [game, onChange],
  );

  const onHint = useCallback(
    async (cell: number | null) => {
      if (game.finishedAt) return null;
      if (game.hints >= MAX_HINTS) return null;
      const open: number[] = [];
      for (let i = 0; i < 81; i++) {
        if (game.puzzle[i] === "0" && game.board[i] !== game.solution[i]) {
          open.push(i);
        }
      }
      // The digit lands through `onPlace` only when the player applies the hint.
      const hint = buildHint(
        game.board,
        game.solution,
        open,
        cell,
        game.candidateEliminations,
      );
      if (!hint) return null;
      track("hint_used", {
        mode: "solo",
        difficulty: game.difficulty,
        is_guest: !isAuthenticated,
      });
      onChange({
        ...game,
        hints: game.hints + 1,
        pendingHint:
          hint.action?.kind === "eliminate"
            ? { board: game.board, changes: hint.action.changes }
            : undefined,
        ...pauseForHint(game, Date.now()),
      });
      return hint;
    },
    [game, onChange, isAuthenticated],
  );

  const onHintEnd = useCallback(
    (apply = false) => {
      const current = soloStore.get();
      if (!current || current.id !== game.id || current.finishedAt) return;
      if (apply) {
        if (!current.pendingHint) return;
        if (current.pendingHint.board !== current.board)
          throw new Error("Hint no longer applies");
        soloStore.set({
          ...current,
          candidateEliminations: applyEliminations(
            current.candidateEliminations,
            current.pendingHint.changes,
          ),
          pendingHint: undefined,
        });
        return;
      }
      soloStore.set({
        ...current,
        ...finishHintClock(current, Date.now()),
        pendingHint: undefined,
      });
    },
    [game.id],
  );

  const topBar = (
    <div className="flex items-baseline justify-between gap-4 py-5">
      <div className="flex min-w-0 items-baseline gap-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          ← Home
        </Link>
        <span className="text-sm text-muted-foreground">
          Solo · {DIFFICULTY_LABEL[game.difficulty]}
        </span>
      </div>
      <Timer clock={clock} className="text-sm" />
    </div>
  );

  const aside = (
    <>
      <p className="text-sm text-muted-foreground">
        {filled} of {totalBlanks} filled · {game.mistakes}/{MAX_MISTAKES}{" "}
        mistakes
        {game.hints
          ? ` · ${game.hints} ${game.hints === 1 ? "hint" : "hints"}`
          : ""}
      </p>
      {!isAuthenticated && !isLoading ? (
        <p className="text-sm text-muted-foreground">
          Playing as a guest. Sign in to keep stats, earn rating points, and
          play with friends.
        </p>
      ) : null}
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
      {justFinished && won ? <Celebration intensity="big" /> : null}
      <Play
        puzzle={game.puzzle}
        board={game.board}
        errors={errors}
        locked={finished}
        paused={clock.paused}
        onResume={clock.pausedByPlayer ? clock.toggle : undefined}
        onPlace={onPlace}
        onHint={onHint}
        onHintEnd={onHintEnd}
        hintPaused={game.hintPaused}
        candidateEliminations={game.candidateEliminations}
        hintsLeft={Math.max(0, MAX_HINTS - game.hints)}
        topBar={topBar}
        aside={aside}
        overlay={
          finished && showResults ? (
            <Overlay label="Results" onDismiss={() => setShowResults(false)}>
              <div className="flex flex-col gap-8 p-6 sm:p-8">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    Solo · {DIFFICULTY_LABEL[game.difficulty]}
                  </p>
                  <h2 className="text-3xl font-medium tracking-tight">
                    {won ? "Solved." : "Game over."}
                  </h2>
                  <p className="font-mono text-2xl tabular-nums">
                    {formatDuration(clockElapsed(game, game.finishedAt!))}
                  </p>
                </div>
                <p className="border-y border-border/50 py-3 text-sm text-muted-foreground">
                  {game.mistakes}/{MAX_MISTAKES} mistakes
                  {game.hints
                    ? ` · ${game.hints} ${game.hints === 1 ? "hint" : "hints"}`
                    : ""}
                </p>
                <div className="flex flex-col gap-5">
                  <Choice
                    label="Difficulty for the next game"
                    value={nextDifficulty}
                    onChange={setNextDifficulty}
                    options={DIFFICULTIES.map((d) => ({
                      value: d,
                      label: DIFFICULTY_LABEL[d],
                    }))}
                  />
                  <div className="flex items-center gap-2">
                    <Button onClick={() => onNew(nextDifficulty)}>
                      {won ? "Play again" : "Restart"}
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/">{won ? "Done" : "Abandon"}</Link>
                    </Button>
                  </div>
                </div>
                {!isAuthenticated && !isLoading ? (
                  <div className="flex flex-col gap-3 border-t border-border/50 pt-6">
                    <p className="text-sm text-muted-foreground">
                      Guest games aren&apos;t saved. Sign in to keep stats and
                      earn rating points.
                    </p>
                    <GoogleButton callbackURL="/" className="self-start" />
                  </div>
                ) : null}
              </div>
            </Overlay>
          ) : null
        }
      />
    </>
  );
}
