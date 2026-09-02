"use client";

import { cn } from "~/lib/utils";

type Option<T extends string> = { value: T; label: string };

/** Inline text radio group: the active option is underlined. */
export function Choice<T extends string>({
  value,
  onChange,
  options,
  label,
  disabled,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly Option<T>[];
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex flex-wrap gap-x-5 gap-y-1", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "cursor-pointer text-sm underline-offset-4 transition-colors outline-none focus-visible:underline disabled:cursor-not-allowed",
              active
                ? "text-foreground underline decoration-foreground/50"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
