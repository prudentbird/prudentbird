import type { Metadata } from "next";
import { Leaderboard } from "~/components/leaderboard/leaderboard";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Global rating across every solo, co-op, versus and daily solve.",
};

export default function LeaderboardPage() {
  return <Leaderboard />;
}
