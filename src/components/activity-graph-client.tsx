"use client";

import Image from "next/image";
import type { DailyActivity } from "~/app/actions/lastfm";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Music } from "lucide-react";
import {
  searchSpotifyTracks,
  type SpotifySearchResult,
} from "~/app/actions/spotify";
import {
  ContributionGraph,
  type ContributionData,
} from "./smoothui/contribution-graph";

export function ActivityGraphClient({
  graphData,
  activities,
}: {
  graphData: ContributionData[];
  activities: DailyActivity[];
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [spotifyTracks, setSpotifyTracks] = useState<
    SpotifySearchResult[] | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const graphWrapRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  const activityMap = useMemo(
    () => new Map(activities.map((a) => [a.date, a])),
    [activities],
  );

  useEffect(() => {
    const wrap = graphWrapRef.current;
    if (!wrap) return;
    const inner = wrap.querySelector<HTMLElement>(".overflow-x-auto");
    if (!inner) return;

    const WEEK_WIDTH = 14;
    const DAY_LABEL_WIDTH = 32;

    const today = new Date();
    const firstSunday = new Date(today.getFullYear(), 0, 1);
    firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());
    const todayWeek = Math.floor(
      (today.getTime() - firstSunday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

    const todayX = DAY_LABEL_WIDTH + todayWeek * WEEK_WIDTH;
    inner.scrollLeft = todayX - inner.clientWidth / 2;
  }, []);

  const handleDayClick = async (date: string) => {
    const activity = activityMap.get(date);
    if (!activity) return;
    const id = ++requestIdRef.current;
    setSelectedDate(date);
    setSpotifyTracks(null);
    setIsLoading(true);
    try {
      const results = await searchSpotifyTracks(activity.tracks);
      if (id !== requestIdRef.current) return;
      setSpotifyTracks(results);
    } finally {
      if (id === requestIdRef.current) setIsLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedDate(null);
    setSpotifyTracks(null);
  };

  const selectedActivity = selectedDate ? activityMap.get(selectedDate) : null;

  if (selectedActivity) {
    return (
      <DayDetail
        activity={selectedActivity}
        tracks={spotifyTracks}
        isLoading={isLoading}
        onBack={handleBack}
      />
    );
  }

  return (
    <div
      ref={graphWrapRef}
      className="h-full [&_.overflow-x-auto]:[mask-image:linear-gradient(to_right,black_96%,transparent)]"
    >
      <ContributionGraph data={graphData} onDayClick={handleDayClick} />
    </div>
  );
}

function DayDetail({
  activity,
  tracks,
  isLoading,
  onBack,
}: {
  activity: DailyActivity;
  tracks: SpotifySearchResult[] | null;
  isLoading: boolean;
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

  const showSkeletons = isLoading || tracks === null;

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
          <span className="text-sm font-medium">{formattedDate}</span>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {activity.count} scrobbles
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-border/50 bg-border/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px h-full overflow-y-auto [scrollbar-width:thin]">
          {showSkeletons
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-background px-3 py-2.5 animate-pulse"
                >
                  <div className="h-2 w-5 shrink-0 rounded bg-muted self-center" />
                  <div className="h-9 w-9 shrink-0 rounded-md bg-muted self-center" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1">
                      <div className="h-2.5 w-3/4 rounded bg-muted" />
                      <div className="h-3 w-3 shrink-0 rounded bg-muted" />
                    </div>
                    <div className="h-2 w-1/2 rounded bg-muted" />
                  </div>
                  <div className="h-2 w-10 shrink-0 rounded bg-muted self-center" />
                </div>
              ))
            : tracks.map((track, i) => (
                <a
                  key={i}
                  href={
                    track.spotifyUrl ??
                    `https://open.spotify.com/search/${encodeURIComponent(`${track.name} ${track.artist}`)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 bg-background px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <span className="shrink-0 w-5 text-right text-xs text-muted-foreground/50 tabular-nums">
                    {tracks.length - i}
                  </span>
                  {track.albumImage ? (
                    <Image
                      src={track.albumImage}
                      alt="Album Cover Image"
                      width={36}
                      height={36}
                      decoding="async"
                      className="h-9 w-9 shrink-0 rounded-md object-cover"
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
              ))}
        </div>
      </div>
    </div>
  );
}
