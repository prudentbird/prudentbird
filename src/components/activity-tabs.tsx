"use client";

import { useState } from "react";

type Mode = "now-playing" | "history";

export function ActivityTabs({
  nowPlaying,
  history,
}: {
  nowPlaying: React.ReactNode;
  history: React.ReactNode;
}) {
  const [mode, setMode] = useState<Mode>("now-playing");

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between gap-3 sm:gap-4">
        <h2 className="text-2xl md:text-3xl font-semibold">Activity</h2>
        <div
          role="radiogroup"
          aria-label="Activity view toggle"
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ToggleOption
            label="now playing"
            active={mode === "now-playing"}
            onClick={() => setMode("now-playing")}
          />
          <span aria-hidden="true" className="text-muted-foreground/40">
            /
          </span>
          <ToggleOption
            label="history"
            active={mode === "history"}
            onClick={() => setMode("history")}
          />
        </div>
      </div>

      <div className="h-[157px] sm:h-[176px]">
        {mode === "now-playing" ? nowPlaying : history}
      </div>
    </section>
  );
}

function ToggleOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`rounded-sm px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
