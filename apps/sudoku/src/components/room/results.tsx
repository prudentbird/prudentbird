"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import type { RoomView } from "~/lib/room-view";
import type { Difficulty } from "~/convex/lib/sudoku";
import { Button } from "~/components/ui/button";
import { Overlay } from "~/components/ui/overlay";
import { Choice } from "~/components/ui/choice";
import { ColorDot } from "~/components/player-avatar";
import { DIFFICULTY_LABEL, MODE_LABEL, formatDuration } from "~/lib/utils";

export function Results({
  view,
  onViewBoard,
}: {
  view: RoomView;
  onViewBoard: () => void;
}) {
  const rematch = useMutation(api.rooms.rematch);
  const { room, players, me, totalBlanks } = view;
  const [difficulty, setDifficulty] = useState<Difficulty>(room.difficulty);
  const [busy, setBusy] = useState(false);

  const elapsed =
    room.startedAt && room.finishedAt ? room.finishedAt - room.startedAt : 0;
  const isVersus = room.mode === "versus";
  const isSolo = room.mode === "solo";
  const winner = players.find((p) => p._id === room.winnerPlayerId);
  const iWon = winner?._id === me.playerId;
  const host = players.find((p) => p.userId === room.hostUserId);
  const myPoints = players.find((p) => p._id === me.playerId)?.points ?? 0;

  const ranked = [...players].sort((a, b) => {
    if (a.finishedAt && b.finishedAt) return a.finishedAt - b.finishedAt;
    if (a.finishedAt) return -1;
    if (b.finishedAt) return 1;
    return b.filled - a.filled || a.mistakes - b.mistakes;
  });

  const onRematch = async () => {
    setBusy(true);
    try {
      await rematch({ roomId: room._id, difficulty });
    } finally {
      setBusy(false);
    }
  };

  const title = isVersus
    ? iWon
      ? "You won."
      : `${winner?.name ?? "Someone"} won.`
    : "Solved.";

  return (
    <Overlay label="Results" onDismiss={onViewBoard}>
      <div className="flex flex-col gap-8 p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {MODE_LABEL[room.mode]} · {DIFFICULTY_LABEL[room.difficulty]}
          </p>
          <h2 className="text-3xl font-medium tracking-tight">{title}</h2>
          <p className="font-mono text-2xl tabular-nums">
            {formatDuration(elapsed)}
          </p>
          {myPoints ? (
            <p className="text-sm text-muted-foreground">
              +{myPoints.toLocaleString()} points
            </p>
          ) : null}
        </div>

        {isSolo ? (
          <p className="border-y border-border/50 py-3 text-sm text-muted-foreground">
            {players[0]?.mistakes ?? 0}{" "}
            {players[0]?.mistakes === 1 ? "mistake" : "mistakes"}
            {players[0]?.hints
              ? ` · ${players[0].hints} ${players[0].hints === 1 ? "hint" : "hints"}`
              : ""}
          </p>
        ) : (
          <ol className="divide-y divide-border/50 border-y border-border/50">
            {ranked.map((p, i) => {
              const pct = totalBlanks
                ? Math.round((p.filled / totalBlanks) * 100)
                : 0;
              const isMe = p._id === me.playerId;
              return (
                <li
                  key={p._id}
                  className="flex items-center gap-3 py-2.5 text-sm"
                >
                  <span className="w-4 font-mono text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <ColorDot color={p.color} />
                  <span className="flex-1 truncate">
                    {p.name}
                    {isMe ? (
                      <span className="text-muted-foreground"> · you</span>
                    ) : null}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {isVersus
                      ? p.finishedAt && room.startedAt
                        ? formatDuration(p.finishedAt - room.startedAt)
                        : `${pct}%`
                      : `${p.filled} cells`}
                    {" · "}
                    {p.mistakes}✕
                    {!isVersus && p.hints ? ` · ${p.hints} hints` : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {me.isHost ? (
          <div className="flex flex-col gap-4">
            <Choice
              label="Difficulty for the next round"
              value={difficulty}
              onChange={setDifficulty}
              options={(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map(
                (d) => ({ value: d, label: DIFFICULTY_LABEL[d] }),
              )}
            />
            <div className="flex items-center gap-2">
              <Button onClick={onRematch} disabled={busy}>
                {busy ? "Starting…" : "Play again"}
              </Button>
              <Button asChild variant="secondary">
                <Link href="/">{isSolo ? "Done" : "Leave"}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {host?.name ?? "The host"} can start another round.
            </p>
            <Button asChild variant="secondary" className="self-start">
              <Link href="/">Leave</Link>
            </Button>
          </div>
        )}
      </div>
    </Overlay>
  );
}
