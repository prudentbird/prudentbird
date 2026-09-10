import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("delete stale rooms", { hours: 6 }, internal.rooms.cleanup, {});
crons.interval(
  "close inactive rooms",
  { minutes: 1 },
  internal.rooms.closeInactive,
  {},
);
crons.interval(
  "delete stale solve events",
  { hours: 24 },
  internal.ratings.cleanupSolveEvents,
  {},
);

export default crons;
