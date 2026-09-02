"use client";

import { useEffect } from "react";
import { cn } from "~/lib/utils";

/** Bottom sheet on small screens, centred panel on larger ones. */
export function Overlay({
  children,
  className,
  label,
  onDismiss,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
  onDismiss?: () => void;
}) {
  useEffect(() => {
    if (!onDismiss) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onDismiss}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "safe-bottom relative max-h-[92dvh] w-full overflow-y-auto border-t border-border/60 bg-background sm:max-w-md sm:rounded-sm sm:border",
          "animate-in duration-300 fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2",
          className,
        )}
      >
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-5 right-6 cursor-pointer text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:top-7 sm:right-8"
          >
            Close
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}
