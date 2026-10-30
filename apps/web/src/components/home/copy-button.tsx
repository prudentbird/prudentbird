"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
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
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          return;
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cn(
        "inline-grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}
