import type { Metadata } from "next";
import { GuestSolo } from "~/components/solo/guest-solo";

export const metadata: Metadata = {
  title: "Solo",
  description: "Play sudoku on your own. No account needed.",
};

export default function SoloPage() {
  return <GuestSolo />;
}
