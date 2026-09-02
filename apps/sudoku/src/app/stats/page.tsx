import type { Metadata } from "next";
import { Stats } from "~/components/stats/stats";

export const metadata: Metadata = {
  title: "Stats",
  robots: { index: false },
};

export default function StatsPage() {
  return <Stats />;
}
