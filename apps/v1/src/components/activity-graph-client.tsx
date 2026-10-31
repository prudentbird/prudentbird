"use client";

import Image from "next/image";
import { getLastFmDay, type DailyActivity } from "~/app/actions/lastfm";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Music } from "lucide-react";
import {
  searchSpotifyTracks,
  type SpotifySearchResult,
} from "~/app/actions/spotify";
import { cn } from "~/lib/utils";
import {
  ContributionGraph,
  type ContributionData,
} from "./smoothui/contribution-graph";

export function ActivityGraphClient({
  graphData,
  year,
}: {
  graphData: ContributionData[];
  year: number;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [enrichedTracks, setEnrichedTracks] = useState<
    SpotifySearchResult[] | null
  >(null);
  const graphWrapRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  const dayCache = useRef(
    new Map<
      string,
      { activity: DailyActivity; enriched: SpotifySearchResult[] }
    >(),
  );
  const [selectedActivity, setSelectedActivity] =
    useState<DailyActivity | null>(null);
  const [dayError, setDayError] = useState(false);

  useEffect(() => {
    const wrap = graphWrapRef.current;
    if (!wrap) return;
    const inner = wrap.querySelector<HTMLElement>(".overflow-x-auto");
    if (!inner) return;

    const WEEK_WIDTH = 14;
    const DAY_LABEL_WIDTH = 32;

    const today = new Date();
    const firstSunday = new Date(year, 0, 1);
    firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());
    const todayWeek = Math.floor(
      (today.getTime() - firstSunday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

    const todayX = DAY_LABEL_WIDTH + todayWeek * WEEK_WIDTH;
    inner.scrollLeft = todayX - inner.clientWidth / 2;
  }, [selectedDate, year]);

  const handleDayClick = async (date: string) => {
    const id = ++requestIdRef.current;
    const cached = dayCache.current.get(date);
    setSelectedDate(date);
    setDayError(false);
    setSelectedActivity(cached?.activity ?? null);
    setEnrichedTracks(cached?.enriched ?? null);
    if (cached) return;
    try {
      const activity = await getLastFmDay(date);
      if (id !== requestIdRef.current) return;
      setSelectedActivity(activity);
      const enriched = await searchSpotifyTracks(activity.tracks);
      dayCache.current.set(date, { activity, enriched });
      if (id !== requestIdRef.current) return;
      setEnrichedTracks(enriched);
    } catch {
      if (id !== requestIdRef.current) return;
      setDayError(true);
    }
  };

  const handleBack = () => {
    ++requestIdRef.current;
    setSelectedActivity(null);
    setSelectedDate(null);
    setEnrichedTracks(null);
  };

  if (selectedDate && (dayError || !selectedActivity))
    return (
      <div
        role="status"
        className="flex h-full items-center justify-center gap-3 text-sm text-muted-foreground"
      >
        {dayError ? "Unable to load this day." : "Loading tracks..."}
        <button type="button" onClick={handleBack} className="underline">
          Back to history
        </button>
        {dayError && (
          <button
            type="button"
            onClick={() => void handleDayClick(selectedDate)}
            className="underline"
          >
            Try again
          </button>
        )}
      </div>
    );

  if (selectedActivity) {
    return (
      <DayDetail
        activity={selectedActivity}
        enrichedTracks={enrichedTracks}
        onBack={handleBack}
      />
    );
  }

  return (
    <div
      ref={graphWrapRef}
      className="h-full [&_.overflow-x-auto]:[mask-image:linear-gradient(to_right,black_96%,transparent)]"
    >
      <ContributionGraph
        year={year}
        data={graphData}
        onDayClick={handleDayClick}
      />
    </div>
  );
}

function AlbumArt({ src, alt }: { src: string; alt: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  return (
    <div className="relative h-9 w-9 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
      <Music
        size={14}
        className={cn(
          "absolute text-muted-foreground/40",
          status === "loaded" && "opacity-0",
        )}
      />
      {status !== "error" && (
        <Image
          src={src}
          alt={alt}
          width={36}
          height={36}
          decoding="async"
          sizes="36px"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={cn(
            "h-9 w-9 object-cover transition-opacity duration-300",
            status === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}

function DayDetail({
  activity,
  enrichedTracks,
  onBack,
}: {
  activity: DailyActivity;
  enrichedTracks: SpotifySearchResult[] | null;
  onBack: () => void;
}) {
  const [y, mo, d] = activity.date.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-baseline justify-between gap-4 shrink-0">
        <div className="flex items-baseline gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            <ArrowLeft size={11} strokeWidth={2} />
            <span>history</span>
          </button>
          <span className="text-muted-foreground/40 text-xs">/</span>
          <span className="text-sm font-medium">{formattedDate} (UTC)</span>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {activity.count} {activity.count === 1 ? "scrobble" : "scrobbles"}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-border/50 bg-border/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px h-full overflow-y-auto [scrollbar-width:thin]">
          {activity.tracks.map((track, i) => {
            const enriched = enrichedTracks?.[i];

            return (
              <a
                key={`${track.name}|||${track.artist}-${i}`}
                href={
                  enriched?.spotifyUrl ??
                  (track.url ||
                    `https://open.spotify.com/search/${encodeURIComponent(`${track.name} ${track.artist}`)}`)
                }
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 bg-background px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <span className="shrink-0 w-5 text-right text-xs text-muted-foreground/50 tabular-nums">
                  {activity.tracks.length - i}
                </span>
                {enriched?.albumImage ? (
                  <AlbumArt
                    src={enriched.albumImage}
                    alt={`Album art for ${track.name}`}
                  />
                ) : (
                  <div className="h-9 w-9 shrink-0 rounded-md bg-muted flex items-center justify-center">
                    <Music size={14} className="text-muted-foreground/40" />
                  </div>
                )}
                <div className="min-w-0 flex-1 flex flex-col">
                  <div className="flex items-center gap-1 min-w-0">
                    <p className="truncate text-sm font-medium leading-none [text-box-trim:trim-both] [text-box-edge:cap_descender]">
                      {track.name}
                    </p>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="truncate text-xs text-muted-foreground leading-none [text-box-trim:trim-both] [text-box-edge:cap_descender]">
                    {track.artist}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground/50 tabular-nums self-center ml-auto">
                  {track.playedAt}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
