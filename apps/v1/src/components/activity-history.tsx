"use client";

import useSWR from "swr";
import { getLastFmHistory } from "~/app/actions/lastfm";
import type { ContributionData } from "./smoothui/contribution-graph";
import { ActivityGraphClient } from "./activity-graph-client";

export function ActivityHistory() {
  const { data, error, isLoading, mutate } = useSWR(
    "lastfm-history",
    getLastFmHistory,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );
  if (error)
    return (
      <div
        role="status"
        className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        Listening history is unavailable.
        <button
          type="button"
          onClick={() => void mutate()}
          className="underline"
        >
          Try again
        </button>
      </div>
    );
  if (isLoading || !data)
    return (
      <div
        role="status"
        className="flex h-32 items-center justify-center text-sm text-muted-foreground"
      >
        Loading history...
      </div>
    );
  const { year, activities } = data;
  if (activities.length === 0)
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No listening history found.
      </div>
    );
  const maxCount = Math.max(
    1,
    ...activities
      .filter((day) => day.date.startsWith(`${year}-`))
      .map((day) => day.count),
  );
  const graphData: ContributionData[] = activities.map(({ date, count }) => ({
    date,
    count,
    level:
      count === 0
        ? 0
        : count >= maxCount * 0.75
          ? 4
          : count >= maxCount * 0.5
            ? 3
            : count >= maxCount * 0.25
              ? 2
              : 1,
  }));
  return <ActivityGraphClient graphData={graphData} year={year} />;
}
