import { ArrowUpRight } from "lucide-react";
import { ThemeSwitcher } from "./theme-switcher";

export function Footer() {
  return (
    <footer className="mb-6 sm:mb-10 flex justify-between items-center">
      <a
        href="/cac.pdf"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-muted-foreground/80 hover:text-foreground transition-colors"
      >
        BN 8524538 · ©{" "}
        {new Intl.DateTimeFormat("en-UK", { year: "numeric" }).format()}{" "}
        PrudentBird
        <ArrowUpRight className="inline-block ml-0.5 size-3.5" />
        <span className="sr-only"> (opens in new tab)</span>
      </a>
      <ThemeSwitcher />
    </footer>
  );
}
