"use client";

import { useState } from "react";
import { cn } from "~/lib/utils";

export function CopyLink({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/room/${code}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; the code is visible on screen anyway
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "cursor-pointer text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground",
        className,
      )}
    >
      {copied ? "Link copied" : "Copy invite link"}
    </button>
  );
}
