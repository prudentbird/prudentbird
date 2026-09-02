import type { Difficulty } from "./sudoku";

/** Points for a solve before multipliers. */
export const BASE_POINTS: Record<Difficulty, number> = {
  easy: 100,
  medium: 200,
  hard: 350,
  expert: 500,
};

/** Par solve time per difficulty. Faster than par scores more, up to 2×. */
export const PAR_MS: Record<Difficulty, number> = {
  easy: 6 * 60_000,
  medium: 12 * 60_000,
  hard: 20 * 60_000,
  expert: 30 * 60_000,
};

export const PERFECT_MULTIPLIER = 1.25;
export const HINT_PENALTY = 0.1;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * points = base × speed × perfect × hints × share
 *   speed   = par / elapsed, clamped to [0.5, 2]
 *   perfect = 1.25 when mistakes === 0
 *   hints   = 1 − 0.1 per hint, floor 0.5
 *   share   = fraction of the board you filled (co-op), else 1
 */
export function scorePoints(args: {
  difficulty: Difficulty;
  elapsedMs: number;
  mistakes: number;
  hints: number;
  share?: number;
}): number {
  const speed = clamp(
    PAR_MS[args.difficulty] / Math.max(args.elapsedMs, 1000),
    0.5,
    2,
  );
  const perfect = args.mistakes === 0 ? PERFECT_MULTIPLIER : 1;
  const hints = Math.max(0.5, 1 - HINT_PENALTY * args.hints);
  const share = clamp(args.share ?? 1, 0, 1);
  return Math.round(
    BASE_POINTS[args.difficulty] * speed * perfect * hints * share,
  );
}
