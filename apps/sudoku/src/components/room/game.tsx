"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import type { RoomView } from "~/lib/room-view";
import { setCell } from "~/convex/lib/sudoku";
import { playerColor } from "~/lib/players";
import { DIFFICULTY_LABEL, MODE_LABEL } from "~/lib/utils";
import { useBecame } from "~/hooks/use-became";
import { Play } from "~/components/sudoku/play";
import type { CellCursor } from "~/components/sudoku/board";
import { Timer } from "~/components/sudoku/timer";
import { Celebration } from "~/components/celebration";
import { CopyLink } from "~/components/room/share-code";
import { PlayersPanel } from "~/components/room/players-panel";
import { EndRoom } from "~/components/room/end-room";
import { Results } from "~/components/room/results";

export function Game({ view }: { view: RoomView }) {
  const { room, players, me, board, owners, errors, totalBlanks } = view;
  const code = room.code;
  const isCoop = room.mode === "coop";
  const isSolo = room.mode === "solo";
  const shared = room.mode !== "versus";
  const finished = room.status === "finished";
  const myPlayer = players.find((p) => p._id === me.playerId);
  const locked = finished || Boolean(myPlayer?.finishedAt);
  const iWon = shared || room.winnerPlayerId === me.playerId;

  const [showResults, setShowResults] = useState(true);
  const justFinished = useBecame(finished);
  const celebrate = justFinished && iWon;

  const place = useMutation(api.game.place).withOptimisticUpdate(
    (store, args) => {
      const current = store.getQuery(api.rooms.get, { code });
      if (!current || current.status !== "ok") return;
      const nextBoard = setCell(current.board, args.cell, args.value);
      const nextOwners = current.owners ? [...current.owners] : null;
      if (nextOwners) {
        nextOwners[args.cell] = args.value === 0 ? null : current.me.playerId;
      }
      store.setQuery(
        api.rooms.get,
        { code },
        {
          ...current,
          board: nextBoard,
          owners: nextOwners,
          errors: current.errors.filter((e) => e !== args.cell),
        },
      );
    },
  );
  const hint = useMutation(api.game.hint);
  const setCursor = useMutation(api.game.setCursor);

  const onPlace = useCallback(
    (cell: number, value: number) => place({ roomId: room._id, cell, value }),
    [place, room._id],
  );
  const onHint = useCallback(
    (cell: number | null) => hint({ roomId: room._id, cell }),
    [hint, room._id],
  );

  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSelect = useCallback(
    (cell: number | null) => {
      if (!isCoop) return;
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
      cursorTimer.current = setTimeout(() => {
        setCursor({ roomId: room._id, cell }).catch(() => {});
      }, 120);
    },
    [isCoop, room._id, setCursor],
  );
  useEffect(() => {
    if (!isCoop) return;
    return () => {
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
      setCursor({ roomId: room._id, cell: null }).catch(() => {});
    };
  }, [isCoop, room._id, setCursor]);

  const cellColors = useMemo(() => {
    if (!owners) return undefined;
    const byId = new Map(players.map((p) => [p._id, playerColor(p.color)]));
    return owners.map((o) => (o ? byId.get(o) : undefined));
  }, [owners, players]);

  const cursors = useMemo(() => {
    if (!isCoop) return undefined;
    const map = new Map<number, CellCursor[]>();
    for (const p of players) {
      if (p._id === me.playerId || p.cursor === undefined) continue;
      const list = map.get(p.cursor) ?? [];
      list.push({ color: playerColor(p.color), name: p.name });
      map.set(p.cursor, list);
    }
    return map;
  }, [isCoop, players, me.playerId]);

  const filled = shared
    ? players.reduce((n, p) => n + p.filled, 0)
    : (myPlayer?.filled ?? 0);

  const topBar = (
    <div className="flex items-baseline justify-between gap-4 py-5">
      <div className="flex min-w-0 items-baseline gap-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          ← Home
        </Link>
        {isSolo ? null : (
          <span className="font-mono text-sm tracking-[0.2em]">
            {room.code}
          </span>
        )}
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {MODE_LABEL[room.mode]} · {DIFFICULTY_LABEL[room.difficulty]}
        </span>
      </div>
      <Timer
        startedAt={room.startedAt}
        finishedAt={room.finishedAt}
        className="text-sm"
      />
    </div>
  );

  const aside = (
    <>
      <p className="text-sm text-muted-foreground">
        {filled} of {totalBlanks} filled · {myPlayer?.mistakes ?? 0}{" "}
        {myPlayer?.mistakes === 1 ? "mistake" : "mistakes"}
        {shared && myPlayer?.hints
          ? ` · ${myPlayer.hints} ${myPlayer.hints === 1 ? "hint" : "hints"}`
          : ""}
      </p>

      {isSolo ? null : (
        <section>
          <h2 className="mb-1 flex items-baseline justify-between text-sm font-medium">
            Players
            <CopyLink code={room.code} className="text-xs" />
          </h2>
          <PlayersPanel view={view} />
        </section>
      )}

      {finished && !showResults ? (
        <button
          type="button"
          onClick={() => setShowResults(true)}
          className="cursor-pointer self-start text-sm underline underline-offset-2"
        >
          Show results
        </button>
      ) : null}

      {me.isHost && !isSolo ? <EndRoom roomId={room._id} /> : null}
    </>
  );

  return (
    <>
      {celebrate ? <Celebration intensity="big" /> : null}
      <Play
        puzzle={room.puzzle}
        board={board}
        errors={errors}
        locked={locked}
        onPlace={onPlace}
        onHint={shared ? onHint : undefined}
        cellColors={cellColors}
        cursors={cursors}
        onSelect={onSelect}
        topBar={topBar}
        aside={aside}
        overlay={
          finished && showResults ? (
            <Results view={view} onViewBoard={() => setShowResults(false)} />
          ) : null
        }
      />
    </>
  );
}
