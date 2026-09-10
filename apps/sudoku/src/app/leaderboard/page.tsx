import type { Metadata } from "next";
import { Leaderboard } from "~/components/leaderboard/leaderboard";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "All-time and weekly ratings across solo, co-op, versus and daily solves, with score, fastest time and mode.",
};

export default function LeaderboardPage() {
  return <Leaderboard />;
}
