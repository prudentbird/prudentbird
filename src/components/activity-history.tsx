import { getLastFmHistory } from "~/app/actions/lastfm";
import { connection } from "next/server";
import type { ContributionData } from "./smoothui/contribution-graph";
import { ActivityGraphClient } from "./activity-graph-client";

export async function ActivityHistory() {
  await connection();
  const activities = await getLastFmHistory();

  if (!activities || activities.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border/50 bg-muted/20 text-sm text-muted-foreground">
        Configure LASTFM_API_KEY and LASTFM_USERNAME to see history.
      </div>
    );
  }

  const maxCount = Math.max(1, ...activities.map((d) => d.count));

  const graphData: ContributionData[] = activities.map((d) => {
    let level = 0;
    if (d.count > 0) {
      if (d.count >= maxCount * 0.75) level = 4;
      else if (d.count >= maxCount * 0.5) level = 3;
      else if (d.count >= maxCount * 0.25) level = 2;
      else level = 1;
    }
    return { date: d.date, count: d.count, level };
  });

  return <ActivityGraphClient graphData={graphData} activities={activities} />;
}
