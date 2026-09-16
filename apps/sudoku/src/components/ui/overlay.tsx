"use client";

import { useEffect, useRef } from "react";
import { cn } from "~/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

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
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog on open and hand it back on close, since
  // this can open without a click (e.g. the first-visit guide). Focusing
  // the first real control (rather than the panel) keeps it as the Tab
  // trap's boundary and gives keyboard users a visible focus ring.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss?.();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      const focusable = panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        : [];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
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
        ref={panelRef}
        tabIndex={-1}
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
