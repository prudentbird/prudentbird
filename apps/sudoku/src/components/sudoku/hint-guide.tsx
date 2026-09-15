"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Hint } from "~/convex/lib/hint";
import { cn } from "~/lib/utils";

type HintGuideProps = {
  hint: Hint;
  /** Index of the step on screen. */
  step: number;
  onBack: () => void;
  onNext: () => void;
  onDone: () => void;
};

/**
 * The hint walkthrough: one step at a time, advanced by the player, with the
 * board highlighting whatever the current step is talking about. A bottom
 * sheet on small screens, an inline panel beside the board on large ones.
 */
export function HintGuide({
  hint,
  step,
  onBack,
  onNext,
  onDone,
}: HintGuideProps) {
  const last = step === hint.steps.length - 1;
  const current = hint.steps[step]!;

  return (
    <div
      role="region"
      aria-label="Hint walkthrough"
      className={cn(
        "safe-bottom z-30 flex flex-col gap-4 border border-border/60 bg-background px-5 py-4",
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:border-x-0 max-lg:border-b-0 max-lg:shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.4)]",
        "lg:rounded-sm",
        "animate-in duration-200 fade-in slide-in-from-bottom-4",
      )}
    >
      <div className="flex flex-col gap-2 text-center">
        <h3 className="text-base font-medium tracking-tight">
          {hint.technique}
        </h3>
        <p
          aria-live="polite"
          className="min-h-10 text-sm text-balance text-muted-foreground"
        >
          {current.text.map((span, i) => (
            <span
              key={i}
              className={cn(
                span.tone === "source" && "font-medium text-hint",
                span.tone === "unit" && "font-medium text-entry",
              )}
            >
              {span.text}
            </span>
          ))}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={step === 0}
          aria-label="Previous step"
          className="-m-2 cursor-pointer p-2 text-entry transition-opacity disabled:invisible"
        >
          <ChevronLeftIcon className="size-5" />
        </button>

        <div className="flex items-center gap-1.5" aria-hidden>
          {hint.steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === step ? "bg-entry" : "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>

        {last ? (
          <button
            type="button"
            onClick={onDone}
            className="-m-2 cursor-pointer p-2 text-sm font-medium text-entry"
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next step"
            className="-m-2 cursor-pointer p-2 text-entry"
          >
            <ChevronRightIcon className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}
