"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import { clearHistory, loadHistory } from "~/lib/local-solo";

/**
 * Whenever the user is signed in, uploads any finished guest solo games as
 * rated solo rooms and clears them locally. Re-arms after sign-out.
 */
export function GuestSync() {
  const { isAuthenticated } = useConvexAuth();
  const importGames = useMutation(api.rooms.importGuestGames);
  const done = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      done.current = false;
      return;
    }
    if (done.current) return;
    const history = loadHistory().filter((g) => g.finishedAt !== undefined);
    if (history.length === 0) return;
    done.current = true;
    importGames({
      games: history.map((g) => ({
        id: g.id,
        difficulty: g.difficulty,
        puzzle: g.puzzle,
        solution: g.solution,
        mistakes: g.mistakes,
        hints: g.hints,
        startedAt: g.startedAt,
        finishedAt: g.finishedAt!,
      })),
    })
      .then((imported) => clearHistory(imported))
      .catch(() => {
        done.current = false;
      });
  }, [isAuthenticated, importGames]);

  return null;
}
