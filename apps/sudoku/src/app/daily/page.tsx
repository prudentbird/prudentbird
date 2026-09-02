import type { Metadata } from "next";
import { Calendar } from "~/components/daily/calendar";

export const metadata: Metadata = {
  title: "Daily challenges",
  description:
    "One shared sudoku every day. Browse the calendar, keep your streak, and see how you rank.",
};

export default function DailyPage() {
  return <Calendar />;
}
