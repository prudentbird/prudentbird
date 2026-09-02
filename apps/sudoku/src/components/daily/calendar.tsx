"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import type { DayButton } from "react-day-picker";
import type { FunctionReturnType } from "convex/server";
import { api } from "~/convex/_generated/api";
import {
  Calendar as ShadcnCalendar,
  CalendarDayButton,
} from "~/components/ui/calendar";
import { GoogleButton } from "~/components/google-button";
import { Narrow, Quiet } from "~/components/room/room";
import { cn, DIFFICULTY_LABEL, formatDuration } from "~/lib/utils";
import { monthOf, todayUtc } from "~/lib/daily";

type CalendarView = Extract<
  FunctionReturnType<typeof api.daily.calendar>,
  { status: "ok" }
>;
type Day = CalendarView["days"][number];

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function Calendar() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [month, setMonth] = useState(() => monthOf(todayUtc()));
  const view = useQuery(
    api.daily.calendar,
    isAuthenticated ? { month } : "skip",
  );
  const today = todayUtc();

  const days = useMemo(() => {
    const map = new Map<string, Day>();
    if (view?.status === "ok") for (const d of view.days) map.set(d.date, d);
    return map;
  }, [view]);

  const modifiers = useMemo(() => {
    const solved: Date[] = [];
    const inProgress: Date[] = [];
    for (const d of days.values()) {
      if (d.mine?.finished) solved.push(toDate(d.date));
      else if (d.mine) inProgress.push(toDate(d.date));
    }
    return { solved, inProgress };
  }, [days]);

  if (isLoading) return <Quiet />;
  if (!isAuthenticated || view?.status === "unauthenticated") {
    return (
      <Narrow>
        <h1 className="text-2xl font-medium tracking-tight">
          Daily challenges
        </h1>
        <p className="text-sm text-muted-foreground">
          One shared puzzle every day.
        </p>
        <GoogleButton
          callbackURL="/daily"
          label="Sign in to play"
          className="mt-4 self-start"
        />
      </Narrow>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-medium tracking-tight">
          Daily challenges
        </h1>
        <p className="text-sm text-muted-foreground">
          One shared puzzle every day. Every past day is playable.
        </p>
      </div>

      <ShadcnCalendar
        timeZone="UTC"
        month={toDate(`${month}-01`)}
        onMonthChange={(d) => setMonth(monthOf(toKey(d)))}
        endMonth={toDate(`${monthOf(today)}-01`)}
        showOutsideDays={false}
        fixedWeeks
        disabled={{ after: toDate(today) }}
        modifiers={modifiers}
        onDayClick={(date, mods) => {
          if (mods.disabled) return;
          router.push(`/daily/${toKey(date)}`);
        }}
        className="w-full bg-transparent p-0 [--cell-size:--spacing(11)] sm:[--cell-size:--spacing(14)]"
        classNames={{
          root: "w-full",
          month: "flex w-full flex-col gap-3",
          caption_label: "text-base font-medium",
          weekdays: "hidden",
          week: "mt-1 flex w-full",
          today: "bg-transparent",
          disabled: "opacity-30",
        }}
        components={{
          DayButton: (props) => (
            <DailyDayButton {...props} info={days.get(toKey(props.day.date))} />
          ),
        }}
      />

      <p className="text-xs text-muted-foreground">
        Filled days are solved. Underlined days are in progress.
      </p>
    </div>
  );
}

function DailyDayButton({
  info,
  modifiers,
  className,
  children,
  ...props
}: React.ComponentProps<typeof DayButton> & { info?: Day }) {
  const solved = modifiers.solved === true;
  const inProgress = modifiers.inProgress === true;
  const disabled = modifiers.disabled === true;

  return (
    <CalendarDayButton
      {...props}
      modifiers={modifiers}
      title={info ? DIFFICULTY_LABEL[info.difficulty] : undefined}
      aria-label={
        info
          ? `${info.date}, ${DIFFICULTY_LABEL[info.difficulty]}${
              solved
                ? `, solved in ${formatDuration(info.mine?.elapsedMs ?? 0)}`
                : inProgress
                  ? ", in progress"
                  : disabled
                    ? ", not yet available"
                    : ""
            }`
          : undefined
      }
      className={cn(
        "gap-0.5 rounded-sm font-normal",
        solved &&
          "bg-foreground text-background hover:bg-foreground/90 hover:text-background",
        !solved && !disabled && "hover:bg-muted",
        modifiers.today && !solved && "font-medium text-entry",
        className,
      )}
    >
      <span
        className={cn(
          "text-sm tabular-nums",
          inProgress && "underline decoration-entry underline-offset-4",
        )}
      >
        {children}
      </span>
      {solved ? (
        <span className="font-mono text-[9px] tabular-nums opacity-100! sm:text-[10px]">
          {formatDuration(info?.mine?.elapsedMs ?? 0)}
        </span>
      ) : null}
    </CalendarDayButton>
  );
}
