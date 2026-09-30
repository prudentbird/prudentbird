"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { hintAction, type Hint } from "~/convex/lib/hint";
import { PEERS } from "~/convex/lib/sudoku";
import { candidateGrid } from "~/convex/lib/hint_engine";
import { Board, type CellCursor } from "~/components/sudoku/board";
import { Controls } from "~/components/sudoku/controls";
import { HintGuide } from "~/components/sudoku/hint-guide";
import { HowToPlay, useHowToPlay } from "~/components/sudoku/how-to-play";
import { Button } from "~/components/ui/button";

type Move = { cell: number; prev: number; next: number };

export type PlayProps = {
  puzzle: string;
  board: string;
  errors: readonly number[];
  locked: boolean;
  /** Clock stopped: the board is covered and every input is refused. */
  paused?: boolean;
  /** Lifts a pause the player asked for. Absent while auto-paused. */
  onResume?: () => void;
  onPlace: (cell: number, value: number) => Promise<unknown> | void;
  /** When provided, a Hint tool appears. Resolves to the walkthrough. */
  onHint?: (cell: number | null) => Promise<Hint | null | undefined>;
  /** Hints remaining before the Hint tool disables itself. */
  hintsLeft?: number;
  /** Hint pauses keep the walkthrough board visible while stopping play. */
  hintPaused?: boolean;
  candidateEliminations?: readonly number[];
  onHintEnd?: (apply?: boolean) => Promise<unknown> | void;
  cellColors?: ReadonlyArray<string | undefined>;
  cursors?: ReadonlyMap<number, CellCursor[]>;
  /** Fired whenever the selection changes (for live cursors). */
  onSelect?: (cell: number | null) => void;
  topBar: ReactNode;
  aside: ReactNode;
  overlay?: ReactNode;
};

/**
 * Hides the board whenever the clock is stopped, so a pause can't be used to
 * study the grid for free. Auto-pauses (tab hidden or blurred) lift
 * themselves on focus and so have nothing to click.
 */
function PausedCover({
  onResume,
  hintPaused,
}: {
  onResume?: () => void;
  hintPaused?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-sm bg-background/95 backdrop-blur-sm">
      <p className="text-sm text-muted-foreground">
        {hintPaused ? "Hint in progress" : "Paused"}
      </p>
      {onResume ? (
        <Button onClick={onResume}>Resume</Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          {hintPaused
            ? "Play resumes when the walkthrough ends."
            : "Come back to this tab to carry on."}
        </p>
      )}
    </div>
  );
}

/**
 * Board + controls + keyboard handling, shared by rooms and the daily.
 * Owns purely local state: selection, pencil marks, undo history.
 */
export function Play({
  puzzle,
  board,
  errors,
  locked,
  paused = false,
  onResume,
  onPlace,
  onHint,
  hintsLeft,
  hintPaused = false,
  candidateEliminations,
  onHintEnd,
  cellColors,
  cursors,
  onSelect,
  topBar,
  aside,
  overlay,
}: PlayProps) {
  const [selected, setSelectedState] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [notes, setNotes] = useState<Map<number, number>>(() => new Map());
  const [history, setHistory] = useState<Move[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const [hintGuide, setHintGuide] = useState<{
    hint: Hint;
    step: number;
    /** Whether the final deduction has been applied. */
    placement: "pending" | "placing" | "placed" | "failed";
  } | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const hintPlacementInFlight = useRef(false);
  // Synchronous guard against repeated clicks before loading state renders.
  const hintRequestInFlight = useRef(false);
  const guide = useHowToPlay();

  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const setSelected = setSelectedState;
  useEffect(() => {
    onSelect?.(selected);
  }, [selected, onSelect]);

  const isEditable = useCallback(
    (cell: number | null): cell is number =>
      cell !== null && !locked && !paused && puzzle[cell] === "0",
    [locked, paused, puzzle],
  );

  // Ordinary moves update history and pencil marks optimistically.
  // Hint placement below waits for the write before updating either.
  const bookkeepLocal = useCallback((cell: number, value: number) => {
    const prev = boardRef.current.charCodeAt(cell) - 48;
    if (prev === value) return;
    setHistory((h) => [...h.slice(-99), { cell, prev, next: value }]);
    if (value !== 0) {
      setNotes((old) => {
        const next = new Map(old);
        next.delete(cell);
        for (const p of PEERS[cell]) {
          const m = old.get(p);
          if (m && m & (1 << value)) next.set(p, m & ~(1 << value));
        }
        return next;
      });
    }
  }, []);

  const commit = useCallback(
    (cell: number, value: number) => {
      bookkeepLocal(cell, value);
      void Promise.resolve(onPlace(cell, value)).catch(() => {});
    },
    [bookkeepLocal, onPlace],
  );

  const enterDigit = useCallback(
    (d: number) => {
      // Blocked while a hint walkthrough is open: editing another cell is
      // harmless, but erasing or overwriting the just-explained one would
      // leave the "must be N" final step pointing at an empty cell.
      if (hintGuide || hintRequestInFlight.current || !isEditable(selected))
        return;
      if (notesMode) {
        if (board[selected] !== "0") return;
        setNotes((old) => {
          const next = new Map(old);
          next.set(selected, (old.get(selected) ?? 0) ^ (1 << d));
          return next;
        });
        return;
      }
      commit(selected, d);
    },
    [isEditable, selected, notesMode, board, commit, hintGuide],
  );

  const erase = useCallback(() => {
    if (hintGuide || hintRequestInFlight.current || !isEditable(selected))
      return;
    if (board[selected] !== "0") {
      commit(selected, 0);
    } else if (notes.get(selected)) {
      setNotes((old) => {
        const next = new Map(old);
        next.delete(selected);
        return next;
      });
    }
  }, [isEditable, selected, board, notes, commit, hintGuide]);

  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const undo = useCallback(() => {
    // Undo could otherwise pop the hint's own history entry and revert the
    // digit the walkthrough just placed, out from under a still-open guide.
    if (locked || paused || hintGuide || hintRequestInFlight.current) return;
    const stack = [...historyRef.current];
    // Skip entries another player has since overwritten.
    while (stack.length) {
      const move = stack.pop()!;
      const current = boardRef.current.charCodeAt(move.cell) - 48;
      if (current !== move.next) continue;
      void Promise.resolve(onPlace(move.cell, move.prev)).catch(() => {});
      setSelected(move.cell);
      break;
    }
    historyRef.current = stack;
    setHistory(stack);
  }, [locked, paused, hintGuide, onPlace, setSelected]);

  const hint = useCallback(async () => {
    if (!onHint || locked || paused) return;
    if (hintGuide || hintRequestInFlight.current) return;
    if (hintsLeft !== undefined && hintsLeft <= 0) return;
    hintRequestInFlight.current = true;
    setHintLoading(true);
    setHintError(null);
    const requestedBoard = boardRef.current;
    try {
      const result = await onHint(isEditable(selected) ? selected : null);
      if (result) {
        setSelected(result.cell);
        setHintGuide({
          hint: { ...result, board: result.board ?? requestedBoard },
          step: 0,
          placement: "pending",
        });
      } else {
        setHintError(
          "No supported logical deduction is available right now. No hint was used.",
        );
      }
    } catch {
      setHintError(
        "Couldn’t load a hint. Check your connection and try again.",
      );
    } finally {
      setHintLoading(false);
      hintRequestInFlight.current = false;
    }
  }, [
    onHint,
    locked,
    paused,
    hintGuide,
    hintsLeft,
    isEditable,
    selected,
    setSelected,
  ]);

  // Apply either a placement or candidate elimination after its write succeeds.
  const applyHint = useCallback(async () => {
    if (
      !hintGuide ||
      locked ||
      (paused && !hintPaused) ||
      hintPlacementInFlight.current
    )
      return;
    const { hint } = hintGuide;
    if (
      hintGuide.step !== hint.steps.length - 1 ||
      hintGuide.placement === "placed"
    )
      return;
    const action = hintAction(hint);
    if (!action) return;
    hintPlacementInFlight.current = true;
    setHintGuide((g) => (g ? { ...g, placement: "placing" } : g));
    try {
      if (action.kind === "eliminate") {
        if (!onHintEnd) throw new Error("Candidate hints are unavailable");
        await onHintEnd(true);
        setNotes((old) => {
          const next = new Map(old);
          // Seed the cells shown in the explanation, then remove only proven candidates.
          for (const mark of hint.steps.at(-1)?.highlight.marks ?? []) {
            if (boardRef.current[mark.cell] !== "0") continue;
            next.set(
              mark.cell,
              mark.digits.reduce((mask, digit) => mask | (1 << digit), 0),
            );
          }
          for (const { cell, digits } of action.changes) {
            const before =
              next.get(cell) ??
              hint.candidateGrid?.[cell]?.reduce(
                (mask, digit) => mask | (1 << digit),
                0,
              ) ??
              0;
            next.set(
              cell,
              digits.reduce((mask, digit) => mask & ~(1 << digit), before),
            );
          }
          return next;
        });
      } else {
        const { cell, value } = action;
        const previous = Number(boardRef.current[cell]);
        await onPlace(cell, value);
        if (previous !== value) {
          setHistory((h) => [
            ...h.slice(-99),
            { cell, prev: previous, next: value },
          ]);
          setNotes((old) => {
            const next = new Map(old);
            next.delete(cell);
            for (const peer of PEERS[cell]) {
              const mask = next.get(peer);
              if (mask) next.set(peer, mask & ~(1 << value));
            }
            return next;
          });
        }
        setFlash(cell);
      }
      setHintGuide((g) =>
        g?.hint === hint ? { ...g, placement: "placed" } : g,
      );
    } catch {
      setHintGuide((g) =>
        g?.hint === hint ? { ...g, placement: "failed" } : g,
      );
    } finally {
      hintPlacementInFlight.current = false;
    }
  }, [hintGuide, locked, paused, hintPaused, onPlace, onHintEnd]);

  const nextHintStep = useCallback(() => {
    setHintGuide((g) =>
      g && g.step < g.hint.steps.length - 1 ? { ...g, step: g.step + 1 } : g,
    );
  }, []);

  const prevHintStep = useCallback(() => {
    setHintGuide((g) => (g && g.step > 0 ? { ...g, step: g.step - 1 } : g));
  }, []);

  const closeHint = useCallback(async () => {
    if (hintPlacementInFlight.current || hintRequestInFlight.current) return;
    hintRequestInFlight.current = true;
    try {
      await onHintEnd?.();
      setHintGuide(null);
      setHintError(null);
    } catch {
      setHintError("Couldn’t resume the game. Try closing the hint again.");
    } finally {
      hintRequestInFlight.current = false;
    }
  }, [onHintEnd]);

  // Navigating away releases this walkthrough's pause as well.
  const hintEndRef = useRef(onHintEnd);
  const activeHintRef = useRef(false);
  useEffect(() => {
    hintEndRef.current = onHintEnd;
    activeHintRef.current = hintGuide !== null;
  }, [onHintEnd, hintGuide]);
  useEffect(
    () => () => {
      if (activeHintRef.current)
        void Promise.resolve(hintEndRef.current?.()).catch(() => {});
    },
    [],
  );

  useEffect(() => {
    if (flash === null) return;
    const id = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(id);
  }, [flash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (guide.open) return;
      if (paused && !hintGuide) {
        if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onResume?.();
        }
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (hintGuide) {
        if (e.key === "Escape") {
          e.preventDefault();
          void closeHint();
        }
        return;
      }
      if (hintRequestInFlight.current) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod || e.altKey) return;

      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        enterDigit(Number(e.key));
        return;
      }
      switch (e.key) {
        case "Backspace":
        case "Delete":
        case "0":
          e.preventDefault();
          erase();
          return;
        case "n":
        case "N":
          e.preventDefault();
          setNotesMode((v) => !v);
          return;
        case "h":
        case "H":
          if (onHint) {
            e.preventDefault();
            void hint();
          }
          return;
        case "Escape":
          setSelected(null);
          return;
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          setSelected((cur) => {
            if (cur === null) return 40;
            const r = Math.floor(cur / 9);
            const c = cur % 9;
            if (e.key === "ArrowUp") return ((r + 8) % 9) * 9 + c;
            if (e.key === "ArrowDown") return ((r + 1) % 9) * 9 + c;
            if (e.key === "ArrowLeft") return r * 9 + ((c + 8) % 9);
            return r * 9 + ((c + 1) % 9);
          });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    enterDigit,
    erase,
    undo,
    hint,
    onHint,
    setSelected,
    guide.open,
    hintGuide,
    closeHint,
    paused,
    onResume,
  ]);

  // Applied deductions survive reloads and are visible to co-op teammates.
  const visibleNotes = useMemo(() => {
    if (!candidateEliminations?.some(Boolean)) return notes;
    const next = new Map(notes);
    const grid = candidateGrid(board, candidateEliminations);
    for (let cell = 0; cell < 81; cell++) {
      if (board[cell] !== "0" || !candidateEliminations[cell]) continue;
      const mask =
        notes.get(cell) ??
        grid[cell]!.reduce((mask, digit) => mask | (1 << digit), 0);
      next.set(cell, mask & ~candidateEliminations[cell]!);
    }
    return next;
  }, [board, notes, candidateEliminations]);

  const errorSet = useMemo(() => new Set(errors), [errors]);
  const selectedValue = selected === null ? "0" : board[selected]!;
  // A finished game drops the walkthrough rather than freezing it on screen;
  // a pause only hides it, since the deduction resumes with the clock.
  const openHintGuide = locked ? null : hintGuide;
  const hintPanel =
    openHintGuide && (!paused || hintPaused) ? (
      <HintGuide
        hint={openHintGuide.hint}
        step={openHintGuide.step}
        placement={openHintGuide.placement}
        onBack={prevHintStep}
        onNext={nextHintStep}
        onApply={() => void applyHint()}
        onDone={() => void closeHint()}
      />
    ) : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8">
      {topBar}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-12">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
          <div className="relative">
            <Board
              puzzle={puzzle}
              board={
                openHintGuide && openHintGuide.placement !== "placed"
                  ? (openHintGuide.hint.board ?? board)
                  : board
              }
              errors={errorSet}
              selected={selected}
              onSelect={(cell) => {
                if (!openHintGuide && !hintLoading) setSelected(cell);
              }}
              notes={visibleNotes}
              cellColors={cellColors}
              cursors={cursors}
              flash={flash}
              highlight={
                openHintGuide?.hint.steps[openHintGuide.step]?.highlight
              }
              hintStepKey={openHintGuide?.step}
              disabled={locked || (paused && !openHintGuide)}
            />
            {paused && !openHintGuide && !hintLoading ? (
              <PausedCover onResume={onResume} hintPaused={hintPaused} />
            ) : null}
          </div>
          {hintPanel ? <div className="lg:hidden">{hintPanel}</div> : null}
          {hintError ? (
            <p role="alert" className="text-sm text-destructive">
              {hintError}
            </p>
          ) : null}
          <div className="safe-bottom sticky bottom-0 z-20 -mx-4 bg-background/90 px-4 pt-1 pb-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:backdrop-blur-none">
            <Controls
              board={board}
              selectedValue={selectedValue}
              notesMode={notesMode}
              canUndo={history.length > 0}
              // Disabled while the walkthrough is open too, not just when
              // the game is locked: erase/undo could otherwise pull the
              // just-explained digit back out from under a still-open guide.
              disabled={
                locked || paused || openHintGuide !== null || hintLoading
              }
              onDigit={enterDigit}
              onErase={erase}
              onUndo={undo}
              onToggleNotes={() => setNotesMode((v) => !v)}
              onHint={onHint ? () => void hint() : undefined}
              hintsLeft={hintsLeft}
              hintBusy={openHintGuide !== null || hintLoading}
              hintLoading={hintLoading}
              onHelp={guide.show}
            />
          </div>
          <p className="hidden text-xs text-muted-foreground/70 lg:block">
            Arrows move · 1–9 enter · ⌫ erase · N notes
            {onHint ? " · H hint" : ""} · ⌘Z undo
          </p>
        </div>
        <aside className="flex flex-col gap-8">
          {hintPanel ? (
            <div className="hidden lg:block">{hintPanel}</div>
          ) : null}
          {aside}
        </aside>
      </div>
      {overlay}
      {guide.open ? (
        <HowToPlay onDismiss={guide.close} hasHint={!!onHint} />
      ) : null}
    </div>
  );
}
