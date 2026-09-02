"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";

/** Host-only "End room" with an inline confirmation. */
export function EndRoom({
  roomId,
  className,
}: {
  roomId: Id<"rooms">;
  className?: string;
}) {
  const close = useMutation(api.rooms.close);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`cursor-pointer text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline ${className ?? ""}`}
      >
        End room
      </button>
    );
  }

  return (
    <span className={`flex items-center gap-3 text-sm ${className ?? ""}`}>
      <span className="text-muted-foreground">End for everyone?</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await close({ roomId });
          } finally {
            setBusy(false);
          }
        }}
        className="cursor-pointer underline underline-offset-2 disabled:opacity-50"
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="cursor-pointer text-muted-foreground underline-offset-2 hover:underline"
      >
        No
      </button>
    </span>
  );
}
