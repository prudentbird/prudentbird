"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import type { RoomView } from "~/lib/room-view";
import { Button } from "~/components/ui/button";
import { CopyLink } from "~/components/room/share-code";
import { PlayersPanel } from "~/components/room/players-panel";
import { EndRoom } from "~/components/room/end-room";
import { DIFFICULTY_LABEL, MODE_DESCRIPTION, MODE_LABEL } from "~/lib/utils";

export function Lobby({ view }: { view: RoomView }) {
  const start = useMutation(api.rooms.start);
  const [busy, setBusy] = useState(false);
  const { room, players, me } = view;
  const host = players.find((p) => p.userId === room.hostUserId);

  const onStart = async () => {
    setBusy(true);
    try {
      await start({ roomId: room._id });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-10 px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Room code</p>
        <p className="font-mono text-5xl tracking-[0.25em] sm:text-6xl">
          {room.code}
        </p>
        <p className="text-sm text-muted-foreground">
          {MODE_LABEL[room.mode]} · {DIFFICULTY_LABEL[room.difficulty]}.{" "}
          {MODE_DESCRIPTION[room.mode]}
        </p>
        <CopyLink code={room.code} className="self-start" />
      </div>

      <section>
        <h2 className="mb-1 flex items-baseline justify-between text-lg font-medium">
          Players
          <span className="text-sm text-muted-foreground">
            {players.length} of 8
          </span>
        </h2>
        <PlayersPanel view={view} />
      </section>

      {me.isHost ? (
        <div className="flex items-center gap-5">
          <Button onClick={onStart} disabled={busy}>
            {busy ? "Starting…" : "Start game"}
          </Button>
          <EndRoom roomId={room._id} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Waiting for {host?.name ?? "the host"} to start. Rooms close after
          five minutes without anyone around.
        </p>
      )}
    </div>
  );
}
