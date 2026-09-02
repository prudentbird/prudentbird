import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Daily } from "~/components/daily/daily";
import { isValidDate, todayUtc } from "~/convex/lib/sudoku";
import { formatDailyDate } from "~/lib/daily";

type Props = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  return {
    title: isValidDate(date) ? `Daily · ${formatDailyDate(date)}` : "Daily",
    robots: { index: false },
  };
}

export default async function DailyDatePage({ params }: Props) {
  const { date } = await params;
  if (!isValidDate(date) || date > todayUtc()) notFound();
  return <Daily date={date} />;
}
