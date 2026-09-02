"use client";

import { memo } from "react";
import { cn } from "~/lib/utils";

export type CellCursor = { color: string; name: string };

type BoardProps = {
  puzzle: string;
  board: string;
  errors: ReadonlySet<number>;
  selected: number | null;
  onSelect: (cell: number) => void;
  /** Bitmask of pencil marks per cell (bit d set = digit d noted). */
  notes: ReadonlyMap<number, number>;
  /** Per-cell text colour override (co-op: who filled it). */
  cellColors?: ReadonlyArray<string | undefined>;
  /** Other players' cursors, by cell. */
  cursors?: ReadonlyMap<number, CellCursor[]>;
  /** Cell to briefly flash (e.g. after a hint). */
  flash?: number | null;
  disabled?: boolean;
};

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const Board = memo(function Board({
  puzzle,
  board,
  errors,
  selected,
  onSelect,
  notes,
  cellColors,
  cursors,
  flash,
  disabled,
}: BoardProps) {
  const selRow = selected === null ? -1 : Math.floor(selected / 9);
  const selCol = selected === null ? -1 : selected % 9;
  const selBox =
    selected === null
      ? -1
      : Math.floor(selRow / 3) * 3 + Math.floor(selCol / 3);
  const selValue = selected === null ? "0" : board[selected];

  return (
    <div
      role="grid"
      aria-label="Sudoku board"
      className={cn(
        "grid aspect-square w-full grid-cols-9 grid-rows-9 overflow-hidden rounded-sm border-2 border-foreground/80 bg-background select-none",
        disabled && "opacity-80",
      )}
    >
      {Array.from({ length: 81 }, (_, i) => {
        const r = Math.floor(i / 9);
        const c = i % 9;
        const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const value = board[i];
        const given = puzzle[i] !== "0";
        const isSelected = i === selected;
        const isPeer =
          !isSelected && (r === selRow || c === selCol || box === selBox);
        const sameValue = !isSelected && selValue !== "0" && value === selValue;
        const isError = errors.has(i);
        const cellCursors = cursors?.get(i);
        const color = cellColors?.[i];
        const cellNotes = value === "0" ? (notes.get(i) ?? 0) : 0;

        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            aria-selected={isSelected}
            aria-label={`Row ${r + 1} column ${c + 1}${
              value === "0" ? " empty" : ` ${value}`
            }`}
            title={cellCursors?.map((p) => p.name).join(", ")}
            onClick={() => onSelect(i)}
            className={cn(
              "relative flex cursor-pointer touch-manipulation items-center justify-center text-[clamp(1.05rem,4.6vw,1.7rem)] tabular-nums transition-colors duration-75 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
              "border-r border-b border-border/70",
              c % 3 === 2 && c !== 8 && "border-r-2 border-r-foreground/80",
              r % 3 === 2 && r !== 8 && "border-b-2 border-b-foreground/80",
              c === 8 && "border-r-0",
              r === 8 && "border-b-0",
              isSelected
                ? "bg-entry/20"
                : sameValue
                  ? "bg-entry/10"
                  : isPeer
                    ? "bg-muted/60"
                    : "bg-transparent",
              given ? "font-medium text-foreground" : "text-entry",
              isError && "text-destructive",
              flash === i && "animate-flash",
            )}
            style={{
              color: !given && !isError && color ? color : undefined,
              boxShadow: cellCursors?.length
                ? `inset 0 0 0 2px ${cellCursors[0]!.color}`
                : undefined,
            }}
          >
            {value !== "0" ? (
              <span
                key={value}
                className={cn("animate-pop", isError && "animate-shake")}
              >
                {value}
              </span>
            ) : cellNotes ? (
              <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-[6%] text-[0.42em] leading-none text-muted-foreground">
                {DIGITS.map((d) => (
                  <span key={d} className="flex items-center justify-center">
                    {cellNotes & (1 << d) ? d : ""}
                  </span>
                ))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
