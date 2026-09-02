"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Choice } from "~/components/ui/choice";
import { GoogleButton } from "~/components/google-button";
import {
  DIFFICULTY_LABEL,
  MODE_DESCRIPTION,
  MODE_LABEL,
  formatDuration,
  normalizeCode,
} from "~/lib/utils";
import { formatDailyDate, todayUtc } from "~/lib/daily";
import type { Difficulty } from "~/convex/lib/sudoku";

type Mode = "solo" | "coop" | "versus";

const DIFFICULTIES = Object.keys(DIFFICULTY_LABEL) as Difficulty[];

export function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-12 px-4 py-12 sm:py-16">
      <div className="flex flex-col gap-4">
        <h1
          className="text-4xl font-medium tracking-tight sm:text-5xl"
          style={{
            background: "var(--text-gradient)",
            WebkitTextFillColor: "transparent",
            WebkitBackgroundClip: "text",
          }}
        >
          Sudoku.
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Play on your own, share a board with friends, or race them on the same
          puzzle. A new daily challenge every day.
        </p>
      </div>

      {isLoading ? null : isAuthenticated ? <SignedIn /> : <SignedOut />}
    </div>
  );
}

function SignedOut() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  return (
    <>
      <section>
        <SectionTitle>Play solo</SectionTitle>
        <div className="flex flex-col gap-5">
          <Choice
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={DIFFICULTIES.map((d) => ({
              value: d,
              label: DIFFICULTY_LABEL[d],
            }))}
          />
          <div className="flex items-center gap-2">
            <Button onClick={() => router.push(`/solo?new=${difficulty}`)}>
              Start
            </Button>
            <Button asChild variant="secondary">
              <Link href="/solo">Resume</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            No account needed. Your game is saved in this browser.
          </p>
        </div>
      </section>
      <section>
        <SectionTitle>Play with friends</SectionTitle>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Sign in for co-op, versus, the daily challenge, stats and the
            leaderboard.
          </p>
          <GoogleButton callbackURL="/" className="self-start" />
        </div>
      </section>
    </>
  );
}

function SignedIn() {
  return (
    <>
      <CreateSection />
      <JoinSection />
      <DailySection />
    </>
  );
}

function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <h2 className="mb-4 flex items-baseline justify-between gap-4 text-lg font-medium">
      {children}
      {aside ? (
        <span className="text-sm font-normal text-muted-foreground">
          {aside}
        </span>
      ) : null}
    </h2>
  );
}

function DailySection() {
  const date = todayUtc();
  const view = useQuery(api.daily.get, { date });
  const difficulty =
    view?.status === "ok"
      ? view.daily.difficulty
      : view?.status === "not_started"
        ? view.difficulty
        : null;
  const attempt = view?.status === "ok" ? view.attempt : null;
  const done = attempt?.finishedAt !== undefined;

  return (
    <section>
      <SectionTitle
        aside={
          <Link
            href="/daily"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            Calendar
          </Link>
        }
      >
        Today&apos;s puzzle
      </SectionTitle>
      <Link
        href={`/daily/${date}`}
        className="group -mx-2 flex items-center justify-between gap-4 rounded-sm px-2 py-3 transition-colors hover:bg-muted/50"
      >
        <span className="flex min-w-0 flex-col">
          <span>{formatDailyDate(date)}</span>
          <span className="text-sm text-muted-foreground">
            {difficulty ? DIFFICULTY_LABEL[difficulty] : " "}
            {done && attempt
              ? ` · done in ${formatDuration(attempt.elapsedMs ?? 0)}${
                  attempt.rank ? ` · #${attempt.rank}` : ""
                }`
              : attempt
                ? ` · in progress, ${attempt.filled} filled`
                : ""}
          </span>
        </span>
        <span className="shrink-0 text-sm text-muted-foreground group-hover:text-foreground">
          {done ? "Results →" : attempt ? "Continue →" : "Play →"}
        </span>
      </Link>
    </section>
  );
}

function CreateSection() {
  const router = useRouter();
  const create = useMutation(api.rooms.create);
  const [mode, setMode] = useState<Mode>("solo");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = await create({ mode, difficulty });
      router.push(`/room/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create room");
      setBusy(false);
    }
  };

  return (
    <section>
      <SectionTitle>New game</SectionTitle>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Choice
            label="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "solo", label: MODE_LABEL.solo },
              { value: "coop", label: MODE_LABEL.coop },
              { value: "versus", label: MODE_LABEL.versus },
            ]}
          />
          <p className="text-sm text-muted-foreground">
            {MODE_DESCRIPTION[mode]}
          </p>
        </div>
        <Choice
          label="Difficulty"
          value={difficulty}
          onChange={setDifficulty}
          options={DIFFICULTIES.map((d) => ({
            value: d,
            label: DIFFICULTY_LABEL[d],
          }))}
        />
        <Button onClick={onCreate} disabled={busy} className="self-start">
          {busy ? "Starting…" : mode === "solo" ? "Start" : "Create room"}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </section>
  );
}

function JoinSection() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    router.push(`/room/${code}`);
  };

  return (
    <section>
      <SectionTitle>Join a room</SectionTitle>
      <form onSubmit={onSubmit} className="flex items-end gap-6">
        <Input
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          placeholder="ABC123"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Room code"
          className="max-w-[10ch] font-mono text-xl tracking-[0.25em] uppercase md:text-xl"
        />
        <button
          type="submit"
          disabled={code.length !== 6}
          className="cursor-pointer pb-1 text-sm underline-offset-2 hover:underline disabled:cursor-default disabled:text-muted-foreground/50 disabled:no-underline"
        >
          Join →
        </button>
      </form>
    </section>
  );
}
