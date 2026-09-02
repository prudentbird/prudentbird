/**
 * Pure sudoku utilities shared by Convex functions.
 * Grids are 81-char strings, row-major, "0" for an empty cell.
 */

export const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Target number of givens left on the board per difficulty. */
const TARGET_CLUES: Record<Difficulty, number> = {
  easy: 42,
  medium: 34,
  hard: 28,
  expert: 24,
};

const ALL_DIGITS = 0b1111111110; // bits 1..9

function buildPeers(): number[][] {
  const peers: number[][] = [];
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    const set = new Set<number>();
    for (let k = 0; k < 9; k++) {
      set.add(r * 9 + k);
      set.add(k * 9 + c);
      set.add((br + Math.floor(k / 3)) * 9 + bc + (k % 3));
    }
    set.delete(i);
    peers.push([...set]);
  }
  return peers;
}

export const PEERS: readonly (readonly number[])[] = buildPeers();

function candidateMask(grid: number[], idx: number): number {
  let mask = ALL_DIGITS;
  const peers = PEERS[idx];
  for (let k = 0; k < peers.length; k++) {
    mask &= ~(1 << grid[peers[k]]);
  }
  return mask & ALL_DIGITS;
}

function popcount(n: number): number {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

/** Picks the empty cell with the fewest candidates. Returns [idx, mask]. */
function pickCell(grid: number[]): [number, number] {
  let best = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (grid[i] !== 0) continue;
    const mask = candidateMask(grid, i);
    const count = popcount(mask);
    if (count < bestCount) {
      best = i;
      bestMask = mask;
      bestCount = count;
      if (count <= 1) break;
    }
  }
  return [best, bestMask];
}

/** Counts solutions up to `limit` (2 is enough to test uniqueness). */
export function countSolutions(grid: number[], limit = 2): number {
  const [idx, mask] = pickCell(grid);
  if (idx === -1) return 1;
  if (mask === 0) return 0;
  let count = 0;
  for (let d = 1; d <= 9; d++) {
    if (!(mask & (1 << d))) continue;
    grid[idx] = d;
    count += countSolutions(grid, limit - count);
    grid[idx] = 0;
    if (count >= limit) break;
  }
  return count;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fillGrid(grid: number[]): boolean {
  const [idx, mask] = pickCell(grid);
  if (idx === -1) return true;
  if (mask === 0) return false;
  const digits = shuffle(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => mask & (1 << d)),
  );
  for (const d of digits) {
    grid[idx] = d;
    if (fillGrid(grid)) return true;
  }
  grid[idx] = 0;
  return false;
}

export function toGridString(grid: number[]): string {
  return grid.join("");
}

export function fromGridString(s: string): number[] {
  const out = new Array<number>(81);
  for (let i = 0; i < 81; i++) out[i] = s.charCodeAt(i) - 48;
  return out;
}

/**
 * Generates a puzzle with a unique solution by carving clues out of a full
 * random grid until the difficulty's clue target is reached.
 */
export function generatePuzzle(difficulty: Difficulty): {
  puzzle: string;
  solution: string;
} {
  const solution = new Array<number>(81).fill(0);
  fillGrid(solution);

  const puzzle = solution.slice();
  const target = TARGET_CLUES[difficulty];
  let clues = 81;
  const order = shuffle(Array.from({ length: 81 }, (_, i) => i));

  for (const idx of order) {
    if (clues <= target) break;
    const saved = puzzle[idx];
    puzzle[idx] = 0;
    if (countSolutions(puzzle.slice(), 2) === 1) {
      clues--;
    } else {
      puzzle[idx] = saved;
    }
  }

  return { puzzle: toGridString(puzzle), solution: toGridString(solution) };
}

/** True when every row, column and box holds exactly the digits 1–9. */
export function isCompleteGrid(grid: string): boolean {
  if (grid.length !== 81) return false;
  const rows = Array.from({ length: 9 }, () => 0);
  const cols = Array.from({ length: 9 }, () => 0);
  const boxes = Array.from({ length: 9 }, () => 0);
  for (let i = 0; i < 81; i++) {
    const d = grid.charCodeAt(i) - 48;
    if (d < 1 || d > 9) return false;
    const bit = 1 << d;
    const r = Math.floor(i / 9);
    const c = i % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    if (rows[r]! & bit || cols[c]! & bit || boxes[b]! & bit) return false;
    rows[r]! |= bit;
    cols[c]! |= bit;
    boxes[b]! |= bit;
  }
  return true;
}

/** Indexes of filled cells whose value disagrees with the solution. */
export function wrongCells(board: string, solution: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < 81; i++) {
    const ch = board[i];
    if (ch !== "0" && ch !== solution[i]) out.push(i);
  }
  return out;
}

/** Number of non-given cells filled with the correct value. */
export function correctCount(
  board: string,
  puzzle: string,
  solution: string,
): number {
  let n = 0;
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] === "0" && board[i] === solution[i]) n++;
  }
  return n;
}

export function blankCount(puzzle: string): number {
  let n = 0;
  for (let i = 0; i < 81; i++) if (puzzle[i] === "0") n++;
  return n;
}

export function setCell(board: string, idx: number, value: number): string {
  return board.slice(0, idx) + String(value) + board.slice(idx + 1);
}

/** Difficulty schedule for the daily challenge, by UTC weekday. */
const DAILY_SCHEDULE: Difficulty[] = [
  "expert", // Sun
  "easy", // Mon
  "medium", // Tue
  "medium", // Wed
  "hard", // Thu
  "hard", // Fri
  "expert", // Sat
];

export function dailyDifficulty(date: string): Difficulty {
  return DAILY_SCHEDULE[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

export function todayUtc(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}
