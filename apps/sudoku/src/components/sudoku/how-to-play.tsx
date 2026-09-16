"use client";

import { useState } from "react";
import { useMounted } from "~/hooks/use-mounted";
import { Overlay } from "~/components/ui/overlay";
import { Button } from "~/components/ui/button";

const SEEN_KEY = "sudoku.guideSeen";

function hasSeenGuide(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markGuideSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // storage unavailable; guide just reappears next visit
  }
}

/** Auto-opens once for first-time visitors; also exposes a manual `show`. */
export function useHowToPlay() {
  const mounted = useMounted();
  const [forceOpen, setForceOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  return {
    open: mounted && (forceOpen || (!dismissed && !hasSeenGuide())),
    show: () => setForceOpen(true),
    close: () => {
      markGuideSeen();
      setForceOpen(false);
      setDismissed(true);
    },
  };
}

export function HowToPlay({
  onDismiss,
  hasHint,
}: {
  onDismiss: () => void;
  /** Whether this game mode offers the Hint tool (rooms may not). */
  hasHint: boolean;
}) {
  return (
    <Overlay label="How to play" onDismiss={onDismiss}>
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Welcome</p>
          <h2 className="text-2xl font-medium tracking-tight">How to play</h2>
        </div>

        <div className="flex flex-col gap-4 text-sm text-muted-foreground">
          <section>
            <h3 className="mb-1 font-medium text-foreground">The rules</h3>
            <p>
              Fill the 9×9 grid so every row, column, and 3×3 box contains the
              digits 1–9 exactly once.
            </p>
          </section>
          <section>
            <h3 className="mb-1 font-medium text-foreground">Controls</h3>
            <ul className="list-disc space-y-1 pl-4">
              <li>Select a cell, then tap a digit to fill it in.</li>
              <li>Notes toggles pencil marks for candidate digits.</li>
              {hasHint ? (
                <li>Hint reveals a cell and explains the reasoning.</li>
              ) : null}
              <li>Undo steps back through your moves.</li>
            </ul>
          </section>
          <section>
            <h3 className="mb-1 font-medium text-foreground">Keyboard</h3>
            <p>
              Arrows move · 1–9 enter · ⌫ erase · N notes
              {hasHint ? " · H hint" : ""} · ⌘Z undo
            </p>
          </section>
        </div>

        <Button onClick={onDismiss} className="self-start">
          Got it
        </Button>
      </div>
    </Overlay>
  );
}
