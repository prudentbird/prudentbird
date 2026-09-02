"use client";

import type { RoomView } from "~/lib/room-view";
import { PRESENCE_WINDOW_MS } from "~/lib/presence";
import { useNow } from "~/hooks/use-now";
import { playerColor } from "~/lib/players";
import { ColorDot, PlayerAvatar } from "~/components/player-avatar";

export function PlayersPanel({ view }: { view: RoomView }) {
  const now = useNow(5000);
  const { room, players, me, totalBlanks } = view;
  const isVersus = room.mode === "versus";

  return (
    <ul className="divide-y divide-border/50">
      {players.map((p) => {
        const online = now - p.lastSeen < PRESENCE_WINDOW_MS;
        const isHost = p.userId === room.hostUserId;
        const isMe = p._id === me.playerId;
        const pct = totalBlanks
          ? Math.round((p.filled / totalBlanks) * 100)
          : 0;
        return (
          <li key={p._id} className="py-2.5">
            <div className="flex items-center gap-2.5 text-sm">
              <PlayerAvatar name={p.name} image={p.image} size={24} />
              <ColorDot color={p.color} />
              <span
                className={`min-w-0 flex-1 truncate ${online ? "" : "text-muted-foreground"}`}
              >
                {p.name}
                <span className="text-muted-foreground">
                  {isMe ? " · you" : ""}
                  {isHost ? " · host" : ""}
                  {!online ? " · away" : ""}
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {isVersus
                  ? p.finishedAt
                    ? "done"
                    : `${pct}%`
                  : `${p.filled} · ${p.mistakes}✕`}
              </span>
            </div>
            {isVersus ? (
              <div className="mt-2 h-px w-full bg-border/60">
                <div
                  className="h-px transition-[width] duration-300"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: playerColor(p.color),
                  }}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
