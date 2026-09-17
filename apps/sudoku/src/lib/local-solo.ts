import { generatePuzzle, type Difficulty } from "~/convex/lib/sudoku";
import {
  applyClock,
  clockPaused,
  type Clock,
  type ClockAction,
} from "~/convex/lib/clock";

export type LocalGame = Clock & {
  /** Client-generated id; doubles as the import key when syncing. */
  id: string;
  difficulty: Difficulty;
  puzzle: string;
  solution: string;
  board: string;
  mistakes: number;
  hints: number;
};

const KEY = "sudoku.solo";
const HISTORY_KEY = "sudoku.solo.history";
const HISTORY_LIMIT = 100;

export function newLocalGame(difficulty: Difficulty): LocalGame {
  const { puzzle, solution } = generatePuzzle(difficulty);
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    difficulty,
    puzzle,
    solution,
    board: puzzle,
    mistakes: 0,
    hints: 0,
    startedAt: now,
    activeMs: 0,
    runningSince: now,
    lastActiveAt: now,
  };
}

export function loadLocalGame(): LocalGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const game = JSON.parse(raw) as LocalGame;
    if (
      typeof game.id !== "string" ||
      typeof game.puzzle !== "string" ||
      game.puzzle.length !== 81 ||
      typeof game.board !== "string" ||
      game.board.length !== 81
    ) {
      return null;
    }
    return game;
  } catch {
    return null;
  }
}

export function saveLocalGame(game: LocalGame | null) {
  try {
    if (game) localStorage.setItem(KEY, JSON.stringify(game));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable; the game still works for this session
  }
}

// A tiny external store so components can read the saved game with
// useSyncExternalStore instead of setting state inside effects.
let cached: LocalGame | null | undefined;
const listeners = new Set<() => void>();

export const soloStore = {
  get(): LocalGame | null {
    if (cached === undefined) cached = loadLocalGame();
    return cached;
  },
  getServer(): LocalGame | null {
    return null;
  },
  set(game: LocalGame | null) {
    cached = game;
    saveLocalGame(game);
    for (const l of listeners) l();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/**
 * Moves the saved game's play clock. The guest game is the only one whose
 * clock lives in the browser, so this stands in for the Convex mutation the
 * daily and rooms use; it reads through the store so back-to-back actions
 * (mount reopening a clock, then a hidden tab pausing it) never see a stale
 * game.
 *
 * `tickLocalClock` below keeps `lastActiveAt` fresh, so a stretch left open
 * by a dead session closes within a heartbeat of when the tab really went.
 */
export function dispatchLocalClock(action: ClockAction) {
  const game = soloStore.get();
  if (!game || game.finishedAt !== undefined) return;
  soloStore.set({ ...game, ...applyClock(game, action, Date.now()) });
}

/**
 * Records that the tab is still alive and playing. Writing to local storage
 * costs nothing, so unlike the daily this can run on a timer: since a repair
 * bills up to the last activity recorded and no further, ticking is what
 * turns "billed to your last move" into "billed to the last few seconds you
 * were actually here".
 */
export function tickLocalClock() {
  const game = soloStore.get();
  if (!game || game.finishedAt !== undefined || clockPaused(game)) return;
  soloStore.set({ ...game, lastActiveAt: Date.now() });
}

/** Finished guest games waiting to be attached to an account. */
export function loadHistory(): LocalGame[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as LocalGame[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function pushHistory(game: LocalGame) {
  try {
    const list = loadHistory().filter((g) => g.id !== game.id);
    list.push(game);
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(list.slice(-HISTORY_LIMIT)),
    );
  } catch {
    // storage unavailable
  }
}

export function clearHistory(ids: string[]) {
  try {
    const keep = loadHistory().filter((g) => !ids.includes(g.id));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(keep));
  } catch {
    // storage unavailable
  }
}
