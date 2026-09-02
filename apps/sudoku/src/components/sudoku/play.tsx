"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PEERS } from "~/convex/lib/sudoku";
import { Board, type CellCursor } from "~/components/sudoku/board";
import { Controls } from "~/components/sudoku/controls";

type Move = { cell: number; prev: number; next: number };

export type PlayProps = {
  puzzle: string;
  board: string;
  errors: readonly number[];
  locked: boolean;
  onPlace: (cell: number, value: number) => Promise<unknown> | void;
  /** When provided, a Hint tool appears. Resolves to the revealed cell. */
  onHint?: (cell: number | null) => Promise<number | null | undefined>;
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

  const commit = useCallback(
    (cell: number, value: number) => {
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
      void Promise.resolve(onPlace(cell, value)).catch(() => {});
    },
    [onPlace],
  );

  const enterDigit = useCallback(
    (d: number) => {
      if (!isEditable(selected)) return;
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
    [isEditable, selected, notesMode, board, commit],
  );

  const erase = useCallback(() => {
    if (!isEditable(selected)) return;
    if (board[selected] !== "0") {
      commit(selected, 0);
    } else if (notes.get(selected)) {
      setNotes((old) => {
        const next = new Map(old);
        next.delete(selected);
        return next;
      });
    }
  }, [isEditable, selected, board, notes, commit]);

  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const undo = useCallback(() => {
    if (locked) return;
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
  }, [locked, onPlace, setSelected]);

  const hint = useCallback(async () => {
    if (!onHint || locked) return;
    try {
      const cell = await onHint(isEditable(selected) ? selected : null);
      if (typeof cell === "number") {
        setSelected(cell);
        setFlash(cell);
        setNotes((old) => {
          if (!old.has(cell)) return old;
          const next = new Map(old);
          next.delete(cell);
          return next;
        });
      }
    } catch {
      // surfaced via server state
    }
  }, [onHint, locked, isEditable, selected, setSelected]);

  useEffect(() => {
    if (flash === null) return;
    const id = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(id);
  }, [flash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
  }, [enterDigit, erase, undo, hint, onHint, setSelected]);

  const errorSet = useMemo(() => new Set(errors), [errors]);
  const selectedValue = selected === null ? "0" : board[selected]!;

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
            disabled={locked}
          />
          <div className="safe-bottom sticky bottom-0 z-20 -mx-4 bg-background/90 px-4 pt-1 pb-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:backdrop-blur-none">
            <Controls
              board={board}
              selectedValue={selectedValue}
              notesMode={notesMode}
              canUndo={history.length > 0}
              disabled={locked}
              onDigit={enterDigit}
              onErase={erase}
              onUndo={undo}
              onToggleNotes={() => setNotesMode((v) => !v)}
              onHint={onHint ? () => void hint() : undefined}
            />
          </div>
          <p className="hidden text-xs text-muted-foreground/70 lg:block">
            Arrows move · 1–9 enter · ⌫ erase · N notes
            {onHint ? " · H hint" : ""} · ⌘Z undo
          </p>
        </div>
        <aside className="flex flex-col gap-8">{aside}</aside>
      </div>
      {overlay}
    </div>
  );
}
