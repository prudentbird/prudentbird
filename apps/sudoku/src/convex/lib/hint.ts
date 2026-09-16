/**
 * Walkthroughs for a hinted digit. Each hint is a short sequence of steps the
 * player advances by hand, pairing a sentence with the cells the board should
 * highlight — the "last possible number" (naked single) and "last remaining
 * cell" (hidden single) techniques a human solver reaches for first, with a
 * plain reveal when neither applies.
 */
import { PEERS } from "./sudoku";

/** A phrase inside a step. Tinted phrases match the board highlight. */
export type HintSpan = { text: string; tone?: "source" | "unit" };

/** Which cells the board should call out while a step is on screen. */
export type HintHighlight = {
  /** Filled cells whose digits do the eliminating. */
  sources: number[];
  /** Cells those digits sweep through, plus the units in play. */
  sweeps: number[];
  /** The row, column or box being narrowed down, drawn as an outline. */
  unit: number[];
  /** The cell the hint solves, once the step points at it. */
  target: number | null;
};

export type HintStep = { text: HintSpan[]; highlight: HintHighlight };

export type Hint = {
  cell: number;
  value: number;
  /** Name of the technique, shown as the walkthrough's title. */
  technique: string;
  steps: HintStep[];
};

const LAST_POSSIBLE = "Last Possible Number";
const LAST_REMAINING = "Last Remaining Cell";
const LONGER_CHAIN = "Longer Deduction";

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

function rowCells(cell: number): number[] {
  const r = Math.floor(cell / 9);
  return Array.from({ length: 9 }, (_, k) => r * 9 + k);
}

function colCells(cell: number): number[] {
  const c = cell % 9;
  return Array.from({ length: 9 }, (_, k) => k * 9 + c);
}

function boxCells(cell: number): number[] {
  const br = Math.floor(cell / 27) * 3;
  const bc = Math.floor((cell % 9) / 3) * 3;
  return Array.from(
    { length: 9 },
    (_, k) => (br + Math.floor(k / 3)) * 9 + bc + (k % 3),
  );
}

/** The units `cell` belongs to, box first — the easiest one to eyeball. */
function unitsOf(cell: number): [number[], string][] {
  return [
    [boxCells(cell), "box"],
    [rowCells(cell), "row"],
    [colCells(cell), "column"],
  ];
}

/** The cells `witness` shares a unit with `blocked` through. */
function sweepBetween(witness: number, blocked: number): number[] {
  if (Math.floor(witness / 9) === Math.floor(blocked / 9))
    return rowCells(witness);
  if (witness % 9 === blocked % 9) return colCells(witness);
  return boxCells(witness);
}

/**
 * Only one digit fits the cell, because its row, column and box between them
 * already use the other eight.
 */
function lastPossibleNumber(
  board: string,
  cell: number,
  value: number,
): HintStep[] | null {
  const cands = candidates(board, cell);
  if (cands.length !== 1 || cands[0] !== value) return null;

  // One example cell per digit, so the board shows eight callouts, not thirty.
  const byDigit = new Map<number, number>();
  for (const p of PEERS[cell]!) {
    const d = board.charCodeAt(p) - 48;
    if (d !== 0 && !byDigit.has(d)) byDigit.set(d, p);
  }
  const sources = [...byDigit.values()];
  const sweeps = [
    ...new Set([...rowCells(cell), ...colCells(cell), ...boxCells(cell)]),
  ].filter((i) => i !== cell);

  return [
    {
      text: [
        { text: "Pay attention to " },
        { text: "this cell's row, column and box", tone: "unit" },
        { text: "." },
      ],
      highlight: { sources: [], sweeps, unit: [], target: cell },
    },
    {
      text: [
        { text: "Every digit except " },
        { text: String(value), tone: "source" },
        { text: " already shows up in " },
        { text: "these cells", tone: "source" },
        { text: "." },
      ],
      highlight: { sources, sweeps, unit: [], target: cell },
    },
    {
      text: [{ text: `Nothing else is left, so this cell must be ${value}.` }],
      highlight: { sources, sweeps, unit: [], target: cell },
    },
  ];
}

/**
 * Every other cell of some unit is ruled out for the digit, so it has nowhere
 * left to go but this one.
 */
function lastRemainingCell(
  board: string,
  cell: number,
  value: number,
): { steps: HintStep[] } | null {
  if (!candidates(board, cell).includes(value)) return null;

  for (const [unit, name] of unitsOf(cell)) {
    const sources: number[] = [];
    const sweeps = new Set<number>();
    let covered = true;

    for (const i of unit) {
      if (i === cell) continue;
      if (board[i] !== "0") continue; // already filled, rules itself out
      // Reuse a digit we are already pointing at where we can.
      let witness = sources.find((w) => PEERS[i]!.includes(w));
      if (witness === undefined) {
        witness = PEERS[i]!.find((p) => board.charCodeAt(p) - 48 === value);
        if (witness === undefined) {
          covered = false;
          break;
        }
        sources.push(witness);
      }
      for (const s of sweepBetween(witness, i)) sweeps.add(s);
    }
    if (!covered || sources.length === 0) continue;

    const highlight = {
      sources,
      sweeps: [...sweeps],
      unit,
      target: cell,
    };
    return {
      steps: [
        {
          text: [
            { text: "Pay attention to " },
            { text: `these ${value}s`, tone: "source" },
            { text: " and the highlighted areas." },
          ],
          highlight: { ...highlight, unit: [], target: null },
        },
        {
          text: [
            { text: "In " },
            { text: `this ${name}`, tone: "unit" },
            { text: `, only one cell is left that can hold ${value}.` },
          ],
          highlight,
        },
        {
          text: [
            {
              text: `Since it is the only option left, this cell must be ${value}.`,
            },
          ],
          highlight,
        },
      ],
    };
  }
  return null;
}

/** No single-unit argument works, so show the cell and say as much. */
function longerChain(cell: number, value: number): HintStep[] {
  const sweeps = [
    ...new Set([...rowCells(cell), ...colCells(cell), ...boxCells(cell)]),
  ].filter((i) => i !== cell);
  return [
    {
      text: [
        { text: "Pay attention to " },
        { text: "this cell's row, column and box", tone: "unit" },
        { text: "." },
      ],
      highlight: { sources: [], sweeps, unit: [], target: cell },
    },
    {
      text: [
        {
          text: `Pinning this one down takes a longer chain than a single row, column or box check — the answer is ${value}.`,
        },
      ],
      highlight: { sources: [], sweeps, unit: [], target: cell },
    },
  ];
}

function explain(board: string, solution: string, cell: number): Hint {
  const value = solution.charCodeAt(cell) - 48;
  const possible = lastPossibleNumber(board, cell, value);
  if (possible) {
    return { cell, value, technique: LAST_POSSIBLE, steps: possible };
  }
  const remaining = lastRemainingCell(board, cell, value);
  if (remaining) {
    return { cell, value, technique: LAST_REMAINING, steps: remaining.steps };
  }
  return {
    cell,
    value,
    technique: LONGER_CHAIN,
    steps: longerChain(cell, value),
  };
}

/**
 * Builds the walkthrough for one cell. Honours `preferred` when the player
 * picked a cell; otherwise favours a cell a technique actually explains, so
 * the hint teaches something instead of just handing over a digit.
 */
export function buildHint(
  board: string,
  solution: string,
  open: readonly number[],
  preferred: number | null,
): Hint | null {
  if (open.length === 0) return null;
  if (preferred !== null && open.includes(preferred)) {
    return explain(board, solution, preferred);
  }

  const teachable = open
    .map((cell) => explain(board, solution, cell))
    .filter((hint) => hint.technique !== LONGER_CHAIN);
  const pool = teachable.length > 0 ? teachable : null;
  if (pool) return pool[Math.floor(Math.random() * pool.length)]!;
  return explain(
    board,
    solution,
    open[Math.floor(Math.random() * open.length)]!,
  );
}
