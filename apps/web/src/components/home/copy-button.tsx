"use client";

import { Check, Copy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <>
      <button
        type="button"
        aria-label={
          status === "copied"
            ? "Copied"
            : status === "failed"
              ? "Copy failed"
              : label
        }
        onClick={async () => {
          let next: "copied" | "failed" = "copied";
          try {
            await navigator.clipboard.writeText(value);
          } catch {
            next = "failed";
          }
          clearTimeout(timer.current);
          setStatus(next);
          timer.current = setTimeout(() => setStatus("idle"), 1500);
        }}
        className={cn(
          "inline-grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          className,
        )}
      >
        {status === "copied" ? (
          <Check className="size-4" />
        ) : status === "failed" ? (
          <X className="size-4" />
        ) : (
          <Copy className="size-4" />
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "copied"
          ? "Copied"
          : status === "failed"
            ? "Copy failed"
            : ""}
      </span>
    </>
  );
}
