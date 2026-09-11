import type { Metadata } from "next";
import { Leaderboard } from "~/components/leaderboard/leaderboard";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "All-time and weekly ratings across every solo, co-op, versus and daily solve, with each player's fastest time.",
};

export default function LeaderboardPage() {
  return <Leaderboard />;
}
