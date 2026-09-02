import { generatePuzzle, type Difficulty } from "~/convex/lib/sudoku";

export type LocalGame = {
  /** Client-generated id; doubles as the import key when syncing. */
  id: string;
  difficulty: Difficulty;
  puzzle: string;
  solution: string;
  board: string;
  mistakes: number;
  hints: number;
  startedAt: number;
  finishedAt?: number;
};

const KEY = "sudoku.solo";
const HISTORY_KEY = "sudoku.solo.history";
const HISTORY_LIMIT = 100;

export function newLocalGame(difficulty: Difficulty): LocalGame {
  const { puzzle, solution } = generatePuzzle(difficulty);
  return {
    id: crypto.randomUUID(),
    difficulty,
    puzzle,
    solution,
    board: puzzle,
    mistakes: 0,
    hints: 0,
    startedAt: Date.now(),
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
