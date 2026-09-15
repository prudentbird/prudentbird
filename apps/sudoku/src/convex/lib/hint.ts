/**
 * Step-by-step reasoning for a hinted digit. Mirrors the "naked single" /
 * "hidden single" techniques a human solver reaches for first, falling
 * back to a generic explanation when neither applies.
 */
import { PEERS } from "./sudoku";

function candidates(board: string, cell: number): number[] {
  const used = new Set<number>();
  for (const p of PEERS[cell]!) {
    const d = board.charCodeAt(p) - 48;
    if (d !== 0) used.add(d);
  }
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (!used.has(d)) out.push(d);
  return out;
}

function unitIndices(cell: number) {
  const r = Math.floor(cell / 9);
  const c = cell % 9;
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  const row: number[] = [];
  const col: number[] = [];
  const box: number[] = [];
  for (let k = 0; k < 9; k++) {
    row.push(r * 9 + k);
    col.push(k * 9 + c);
    box.push((br + Math.floor(k / 3)) * 9 + bc + (k % 3));
  }
  return { row, col, box };
}

/** True when `value` is impossible in every other empty cell of `unit`. */
function isHiddenSingle(
  board: string,
  unit: readonly number[],
  cell: number,
  value: number,
): boolean {
  return unit.every(
    (i) => i === cell || board[i] !== "0" || !candidates(board, i).includes(value),
  );
}

/** Step-by-step reasoning for why `value` fits at `cell`. */
export function explainHint(board: string, cell: number, value: number): string[] {
  const cands = candidates(board, cell);
  if (cands.length === 1 && cands[0] === value) {
    return [
      "Every other digit already appears in this cell's row, column, or 3×3 box.",
      `${value} is the only digit left that fits — a naked single.`,
    ];
  }

  const units: [readonly number[], string][] = (() => {
    const { row, col, box } = unitIndices(cell);
    return [
      [row, "row"],
      [col, "column"],
      [box, "3×3 box"],
    ];
  })();
  if (cands.includes(value)) {
    for (const [unit, name] of units) {
      if (isHiddenSingle(board, unit, cell, value)) {
        return [
          `Every other empty cell in this ${name} already rules out ${value}.`,
          `That makes this the only cell in the ${name} that can hold ${value} — a hidden single.`,
        ];
      }
    }
  }

  return [
    "This one needs a longer chain of deduction than a single row, column, or box check.",
    `${value} is the solution digit for this hint.`,
  ];
}
