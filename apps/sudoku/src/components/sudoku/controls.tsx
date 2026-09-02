"use client";

import { cn } from "~/lib/utils";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

type ControlsProps = {
  board: string;
  /** Value in the selected cell, "0" if empty or none selected. */
  selectedValue: string;
  notesMode: boolean;
  canUndo: boolean;
  disabled?: boolean;
  onDigit: (d: number) => void;
  onErase: () => void;
  onUndo: () => void;
  onToggleNotes: () => void;
  onHint?: () => void;
};

export function Controls({
  board,
  selectedValue,
  notesMode,
  canUndo,
  disabled,
  onDigit,
  onErase,
  onUndo,
  onToggleNotes,
  onHint,
}: ControlsProps) {
  const counts = new Array<number>(10).fill(0);
  for (let i = 0; i < 81; i++) counts[board.charCodeAt(i) - 48]++;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="Digits"
        className="grid grid-cols-9 divide-x divide-border/60 border-y border-border/60"
      >
        {DIGITS.map((d) => {
          const exhausted = counts[d] >= 9;
          const active = selectedValue === String(d);
          return (
            <button
              key={d}
              type="button"
              disabled={disabled || (exhausted && !notesMode)}
              onClick={() => onDigit(d)}
              aria-label={`${notesMode ? "Note" : "Enter"} ${d}`}
              className={cn(
                "h-12 cursor-pointer touch-manipulation text-xl tabular-nums transition-colors outline-none select-none sm:h-14 sm:text-2xl",
                "hover:bg-muted/70 focus-visible:bg-muted active:bg-muted",
                "disabled:cursor-default disabled:text-muted-foreground/35 disabled:hover:bg-transparent",
                active && "bg-muted",
                notesMode && !exhausted && "text-muted-foreground",
              )}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div
        role="group"
        aria-label="Tools"
        className="flex items-center justify-between px-1 text-sm"
      >
        <Tool label="Undo" onClick={onUndo} disabled={disabled || !canUndo} />
        <Tool label="Erase" onClick={onErase} disabled={disabled} />
        <Tool
          label="Notes"
          onClick={onToggleNotes}
          pressed={notesMode}
          disabled={disabled}
        />
        {onHint ? (
          <Tool label="Hint" onClick={onHint} disabled={disabled} />
        ) : null}
      </div>
    </div>
  );
}

function Tool({
  label,
  onClick,
  disabled,
  pressed,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={cn(
        "-mx-2 cursor-pointer touch-manipulation px-2 py-2 underline-offset-4 transition-colors outline-none select-none focus-visible:underline",
        "disabled:cursor-default disabled:text-muted-foreground/40",
        pressed
          ? "text-foreground underline decoration-foreground/50"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
