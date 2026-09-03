"use client";

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
import { useConvexAuth } from "convex/react";
import {
  DIFFICULTIES,
  setCell,
  wrongCells,
  type Difficulty,
} from "~/convex/lib/sudoku";
import {
  newLocalGame,
  pushHistory,
  soloStore,
  type LocalGame,
} from "~/lib/local-solo";
import { DIFFICULTY_LABEL, formatDuration } from "~/lib/utils";
import { track } from "~/lib/analytics";
import { useBecame } from "~/hooks/use-became";
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
      duration_ms: Date.now() - current.startedAt,
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
  const { isAuthenticated, isLoading } = useConvexAuth();
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
          pushHistory(g);
          track("game_completed", {
            mode: "solo",
            difficulty: g.difficulty,
            is_guest: isGuest,
            duration_ms: g.finishedAt - g.startedAt,
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
  const { isAuthenticated } = useConvexAuth();
  const finished = game.finishedAt !== undefined;
  const justFinished = useBecame(finished);
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
      onChange({
        ...game,
        board,
        mistakes: wrong ? game.mistakes + 1 : game.mistakes,
        ...(solved ? { finishedAt: Date.now() } : {}),
      });
    },
    [game, onChange],
  );

  const onHint = useCallback(
    async (cell: number | null) => {
      if (game.finishedAt) return null;
      const isOpen = (i: number) =>
        game.puzzle[i] === "0" && game.board[i] !== game.solution[i];
      let target = cell;
      if (target === null || !isOpen(target)) {
        const open: number[] = [];
        for (let i = 0; i < 81; i++) if (isOpen(i)) open.push(i);
        if (open.length === 0) return null;
        target = open[Math.floor(Math.random() * open.length)]!;
      }
      const board = setCell(
        game.board,
        target,
        game.solution.charCodeAt(target) - 48,
      );
      const solved = board === game.solution;
      track("hint_used", {
        mode: "solo",
        difficulty: game.difficulty,
        is_guest: !isAuthenticated,
      });
      onChange({
        ...game,
        board,
        hints: game.hints + 1,
        ...(solved ? { finishedAt: Date.now() } : {}),
      });
      return target;
    },
    [game, onChange, isAuthenticated],
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
      <Timer
        startedAt={game.startedAt}
        finishedAt={game.finishedAt}
        className="text-sm"
      />
    </div>
  );

  const aside = (
    <>
      <p className="text-sm text-muted-foreground">
        {filled} of {totalBlanks} filled · {game.mistakes}{" "}
        {game.mistakes === 1 ? "mistake" : "mistakes"}
        {game.hints
          ? ` · ${game.hints} ${game.hints === 1 ? "hint" : "hints"}`
          : ""}
      </p>
      {!isAuthenticated ? (
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
      {justFinished ? <Celebration intensity="big" /> : null}
      <Play
        puzzle={game.puzzle}
        board={game.board}
        errors={errors}
        locked={finished}
        onPlace={onPlace}
        onHint={onHint}
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
                    Solved.
                  </h2>
                  <p className="font-mono text-2xl tabular-nums">
                    {formatDuration(game.finishedAt! - game.startedAt)}
                  </p>
                </div>
                <p className="border-y border-border/50 py-3 text-sm text-muted-foreground">
                  {game.mistakes} {game.mistakes === 1 ? "mistake" : "mistakes"}
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
                      Play again
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/">Done</Link>
                    </Button>
                  </div>
                </div>
                {!isAuthenticated ? (
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
