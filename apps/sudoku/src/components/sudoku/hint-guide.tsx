"use client";

import { XIcon } from "lucide-react";
import { hintAction, type Hint } from "~/convex/lib/hint";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type HintGuideProps = {
  hint: Hint;
  step: number;
  placement: "pending" | "placing" | "placed" | "failed";
  onBack: () => void;
  onNext: () => void;
  onApply: () => void;
  onDone: () => void;
};

/** In-flow on mobile so the explanation never covers the grid. */
export function HintGuide({
  hint,
  step,
  placement,
  onBack,
  onNext,
  onApply,
  onDone,
}: HintGuideProps) {
  const last = step === hint.steps.length - 1;
  const current = hint.steps[step]!;
  const placing = placement === "placing";
  const action = hintAction(hint);

  return (
    <div
      role="region"
      aria-label="Hint walkthrough"
      className="flex flex-col gap-3 rounded-sm border border-border/60 bg-background px-4 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium tracking-tight">
            {hint.technique}
          </h3>
          <p className="text-xs text-muted-foreground">
            {action?.kind === "place"
              ? `Row ${Math.floor(action.cell / 9) + 1}, column ${(action.cell % 9) + 1} · `
              : ""}
            Step {step + 1} of {hint.steps.length}
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          disabled={placing}
          aria-label="Close hint"
          className="-m-1 cursor-pointer rounded-sm p-2 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      <p aria-live="polite" className="min-h-10 text-sm text-muted-foreground">
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
      {placement === "failed" ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t apply the hint. Try again; this won&apos;t use another
          hint.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={step === 0 || placing}
        >
          Back
        </Button>
        {placement === "placed" ? (
          <Button size="sm" onClick={onDone}>
            Resume game
          </Button>
        ) : last ? (
          <Button size="sm" onClick={onApply} disabled={placing}>
            {placing
              ? "Saving…"
              : placement === "failed"
                ? "Try again"
                : action?.kind === "eliminate"
                  ? "Remove candidates"
                  : `Place ${action?.kind === "place" ? action.value : hint.value}`}
          </Button>
        ) : (
          <Button size="sm" onClick={onNext} disabled={placing}>
            Next
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Game paused while you follow the hint.
      </p>
    </div>
  );
}
