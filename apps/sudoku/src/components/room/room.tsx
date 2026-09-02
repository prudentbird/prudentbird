"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import type { RoomView } from "~/lib/room-view";
import { GoogleButton } from "~/components/google-button";
import { Lobby } from "~/components/room/lobby";
import { Game } from "~/components/room/game";

export function Room({ code }: { code: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const view = useQuery(api.rooms.get, isAuthenticated ? { code } : "skip");
  const join = useMutation(api.rooms.join);
  const [joinError, setJoinError] = useState<string | null>(null);
  const joining = useRef(false);

  const needsJoin = view?.status === "not_member";
  useEffect(() => {
    if (!needsJoin || joining.current) return;
    joining.current = true;
    join({ code })
      .catch((err: unknown) => {
        setJoinError(err instanceof Error ? err.message : "Could not join");
      })
      .finally(() => {
        joining.current = false;
      });
  }, [needsJoin, join, code]);

  if (isLoading) return <Quiet />;

  if (!isAuthenticated || view?.status === "unauthenticated") {
    return (
      <Narrow>
        <p className="text-sm text-muted-foreground">You&apos;re joining</p>
        <p className="font-mono text-4xl tracking-[0.25em]">{code}</p>
        <GoogleButton
          callbackURL={`/room/${code}`}
          label="Sign in to join"
          className="mt-4 self-start"
        />
      </Narrow>
    );
  }

  if (view === undefined) return <Quiet />;

  if (view.status === "not_found") {
    return (
      <Narrow>
        <h1 className="text-lg font-medium">Room not found</h1>
        <p className="text-sm text-muted-foreground">
          There&apos;s no room with code{" "}
          <span className="font-mono">{code}</span>. Check the code or{" "}
          <Link href="/" className="underline underline-offset-2">
            create a new room
          </Link>
          .
        </p>
      </Narrow>
    );
  }

  if (view.status === "not_member") {
    if (joinError) {
      return (
        <Narrow>
          <h1 className="text-lg font-medium">Couldn&apos;t join</h1>
          <p className="text-sm text-muted-foreground">{joinError}</p>
          <Link href="/" className="text-sm underline underline-offset-2">
            Back home
          </Link>
        </Narrow>
      );
    }
    return <Quiet label="Joining…" />;
  }

  return <RoomBody view={view} />;
}

function RoomBody({ view }: { view: RoomView }) {
  const heartbeat = useMutation(api.game.heartbeat);
  const roomId = view.room._id;

  useEffect(() => {
    const ping = () => {
      heartbeat({ roomId }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [heartbeat, roomId]);

  if (view.room.status === "closed") return <Closed view={view} />;
  if (view.room.status === "lobby") return <Lobby view={view} />;
  return <Game key={view.room.round} view={view} />;
}

function Closed({ view }: { view: RoomView }) {
  const host = view.players.find((p) => p.userId === view.room.hostUserId);
  return (
    <Narrow>
      <p className="font-mono text-sm tracking-[0.2em] text-muted-foreground">
        {view.room.code}
      </p>
      <h1 className="text-2xl font-medium tracking-tight">Room ended</h1>
      <p className="text-sm text-muted-foreground">
        {view.room.closedReason === "host"
          ? `${host?.name ?? "The host"} ended the room.`
          : "Closed after five minutes with nobody around."}
      </p>
      <Link href="/" className="mt-2 text-sm underline underline-offset-2">
        Back home
      </Link>
    </Narrow>
  );
}

export function Narrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-2 px-4 py-14">
      {children}
    </div>
  );
}

export function Quiet({ label }: { label?: string }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-14 text-sm text-muted-foreground">
      {label ?? "Loading…"}
    </div>
  );
}
