"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Sun, Monitor, MoonStar } from "lucide-react";
import dynamic from "next/dynamic";

const ThemeMenu = dynamic(() => import("./theme-menu"), {
  ssr: false,
  loading: () => <Skeleton className="size-8 sm:hidden" />,
});

const button = "size-6";
const icon = "size-3.5";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <>
        <Skeleton className="size-8 sm:hidden" />
        <Skeleton className="hidden h-[1.875rem] w-[5.25rem] rounded-full sm:inline-flex" />
      </>
    );
  }

  return (
    <>
      <ThemeMenu theme={theme} setTheme={setTheme} />

      <div className="hidden sm:inline-flex items-center rounded-full bg-muted p-0.5 border gap-0.5 border-border/60">
        <Button
          onClick={() => setTheme("light")}
          variant="ghost"
          size="icon"
          className={`rounded-full ${button} transition-colors ${
            theme === "light"
              ? "bg-accent-foreground/60 text-background/80 hover:text-background/80 hover:bg-accent-foreground/60 dark:hover:bg-background"
              : "text-accent-foreground/80 hover:text-accent-foreground hover:bg-muted-foreground/60 dark:hover:bg-background/60"
          }`}
          aria-label="Light mode"
          aria-pressed={theme === "light"}
        >
          <Sun className={icon} />
        </Button>
        <Button
          onClick={() => setTheme("system")}
          variant="ghost"
          size="icon"
          className={`rounded-full ${button} transition-colors ${
            theme === "system"
              ? "bg-background text-foreground hover:bg-background dark:hover:bg-background"
              : "text-accent-foreground/80 hover:text-accent-foreground hover:bg-muted-foreground/60 dark:hover:bg-background/60"
          }`}
          aria-label="System mode"
          aria-pressed={theme === "system"}
        >
          <Monitor className={icon} />
        </Button>
        <Button
          onClick={() => setTheme("dark")}
          variant="ghost"
          size="icon"
          className={`rounded-full ${button} transition-colors ${
            theme === "dark"
              ? "bg-background text-foreground hover:bg-background dark:hover:bg-background"
              : "text-accent-foreground/80 hover:text-accent-foreground hover:bg-muted-foreground/60 dark:hover:bg-background/60"
          }`}
          aria-label="Dark mode"
          aria-pressed={theme === "dark"}
        >
          <MoonStar className={icon} />
        </Button>
      </div>
    </>
  );
}
