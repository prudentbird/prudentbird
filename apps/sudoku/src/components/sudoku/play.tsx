"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Hint } from "~/convex/lib/hint";
import { PEERS } from "~/convex/lib/sudoku";
import { Board, type CellCursor } from "~/components/sudoku/board";
import { Controls } from "~/components/sudoku/controls";
import { HintGuide } from "~/components/sudoku/hint-guide";
import { HowToPlay, useHowToPlay } from "~/components/sudoku/how-to-play";

type Move = { cell: number; prev: number; next: number };

export type PlayProps = {
  puzzle: string;
  board: string;
  errors: readonly number[];
  locked: boolean;
  onPlace: (cell: number, value: number) => Promise<unknown> | void;
  /** When provided, a Hint tool appears. Resolves to the walkthrough. */
  onHint?: (cell: number | null) => Promise<Hint | null | undefined>;
  /** Hints remaining before the Hint tool disables itself. */
  hintsLeft?: number;
  cellColors?: ReadonlyArray<string | undefined>;
  cursors?: ReadonlyMap<number, CellCursor[]>;
  /** Fired whenever the selection changes (for live cursors). */
  onSelect?: (cell: number | null) => void;
  topBar: ReactNode;
  aside: ReactNode;
  overlay?: ReactNode;
};

/**
 * Board + controls + keyboard handling, shared by rooms and the daily.
 * Owns purely local state: selection, pencil marks, undo history.
 */
export function Play({
  puzzle,
  board,
  errors,
  locked,
  onPlace,
  onHint,
  hintsLeft,
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
    /** Only meaningful on the final step, where the digit actually lands. */
    placement: "pending" | "placing" | "placed" | "failed";
  } | null>(null);
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
      cell !== null && !locked && puzzle[cell] === "0",
    [locked, puzzle],
  );

  // Local bookkeeping (undo history, pencil-mark cleanup) is applied
  // optimistically and never rolled back — only the network write can fail,
  // and only the hint walkthrough (below) needs to know if it did.
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
      if (hintGuide || !isEditable(selected)) return;
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
    if (hintGuide || !isEditable(selected)) return;
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
    if (locked || hintGuide) return;
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
  }, [locked, hintGuide, onPlace, setSelected]);

  // A ref, not state: `hintGuide` only updates once `onHint` resolves, so a
  // second click or "H" press before then would still see it as null and
  // fire a second request. This flips synchronously on the first click.
  const hintRequestInFlight = useRef(false);

  const hint = useCallback(async () => {
    if (!onHint || locked) return;
    if (hintGuide || hintRequestInFlight.current) return;
    if (hintsLeft !== undefined && hintsLeft <= 0) return;
    hintRequestInFlight.current = true;
    try {
      const result = await onHint(isEditable(selected) ? selected : null);
      if (result) {
        setSelected(result.cell);
        setHintGuide({ hint: result, step: 0, placement: "pending" });
      }
    } catch {
      // surfaced via server state
    } finally {
      hintRequestInFlight.current = false;
    }
  }, [onHint, locked, hintGuide, hintsLeft, isEditable, selected, setSelected]);

  // The hint is already spent server-side by the time the walkthrough opens,
  // so a failed write here must not vanish silently — the player is told and
  // can retry, rather than losing the hint with nothing to show for it.
  const placeHint = useCallback(
    (hint: Hint) => {
      setFlash(hint.cell);
      setHintGuide({ hint, step: hint.steps.length - 1, placement: "placing" });
      void Promise.resolve(onPlace(hint.cell, hint.value)).then(
        () =>
          setHintGuide((g) =>
            g && g.hint === hint ? { ...g, placement: "placed" } : g,
          ),
        () =>
          setHintGuide((g) =>
            g && g.hint === hint ? { ...g, placement: "failed" } : g,
          ),
      );
    },
    [onPlace],
  );

  const nextHintStep = useCallback(() => {
    if (!hintGuide) return;
    const step = hintGuide.step + 1;
    if (step >= hintGuide.hint.steps.length) return;
    if (step === hintGuide.hint.steps.length - 1) {
      bookkeepLocal(hintGuide.hint.cell, hintGuide.hint.value);
      placeHint(hintGuide.hint);
    } else {
      setHintGuide({ ...hintGuide, step });
    }
  }, [hintGuide, bookkeepLocal, placeHint]);

  const retryHintPlacement = useCallback(() => {
    if (hintGuide?.placement === "failed") placeHint(hintGuide.hint);
  }, [hintGuide, placeHint]);

  const prevHintStep = useCallback(() => {
    setHintGuide((g) => (g && g.step > 0 ? { ...g, step: g.step - 1 } : g));
  }, []);

  useEffect(() => {
    if (flash === null) return;
    const id = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(id);
  }, [flash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (guide.open) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
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
          // Deliberately does not close the hint walkthrough: a hint is
          // spent either way, so the only way out is to read it through.
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
  }, [enterDigit, erase, undo, hint, onHint, setSelected, guide.open]);

  const errorSet = useMemo(() => new Set(errors), [errors]);
  const selectedValue = selected === null ? "0" : board[selected]!;
  // A finished game drops the walkthrough rather than freezing it on screen.
  const openHintGuide = locked ? null : hintGuide;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8">
      {topBar}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-12">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
          <Board
            puzzle={puzzle}
            board={board}
            errors={errorSet}
            selected={selected}
            onSelect={(cell) => setSelected(cell)}
            notes={notes}
            cellColors={cellColors}
            cursors={cursors}
            flash={flash}
            highlight={openHintGuide?.hint.steps[openHintGuide.step]?.highlight}
            disabled={locked}
          />
          <div className="safe-bottom sticky bottom-0 z-20 -mx-4 bg-background/90 px-4 pt-1 pb-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:backdrop-blur-none">
            <Controls
              board={board}
              selectedValue={selectedValue}
              notesMode={notesMode}
              canUndo={history.length > 0}
              // Disabled while the walkthrough is open too, not just when
              // the game is locked: erase/undo could otherwise pull the
              // just-explained digit back out from under a still-open guide.
              disabled={locked || openHintGuide !== null}
              onDigit={enterDigit}
              onErase={erase}
              onUndo={undo}
              onToggleNotes={() => setNotesMode((v) => !v)}
              onHint={onHint ? () => void hint() : undefined}
              hintsLeft={hintsLeft}
              hintBusy={openHintGuide !== null}
              onHelp={guide.show}
            />
          </div>
          <p className="hidden text-xs text-muted-foreground/70 lg:block">
            Arrows move · 1–9 enter · ⌫ erase · N notes
            {onHint ? " · H hint" : ""} · ⌘Z undo
          </p>
        </div>
        <aside className="flex flex-col gap-8">
          {/* Below lg the walkthrough is a fixed bottom sheet, so it sits
              outside this column's flow; at lg it heads up the sidebar,
              where it stays in view for the whole deduction. */}
          {openHintGuide ? (
            <HintGuide
              hint={openHintGuide.hint}
              step={openHintGuide.step}
              placement={openHintGuide.placement}
              onBack={prevHintStep}
              onNext={nextHintStep}
              onRetry={retryHintPlacement}
              onDone={() => setHintGuide(null)}
            />
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
