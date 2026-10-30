"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Sun, Monitor, MoonStar } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export function ThemeSwitcher({
  size = "default",
}: {
  /** "sm" sits beside small print, e.g. a footer's legal line. */
  size?: "default" | "sm";
}) {
  const { theme, setTheme } = useTheme();
  const sm = size === "sm";
  const button = sm ? "size-6" : "h-8 w-8";
  const icon = sm ? "size-3.5" : "h-4 w-4";

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <>
        <Skeleton className={cn("sm:hidden", sm ? "size-8" : "h-10 w-10")} />
        <Skeleton
          className={cn(
            "hidden sm:inline-flex rounded-full",
            sm ? "h-[1.875rem] w-[5.25rem]" : "h-9 w-28",
          )}
        />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "sm:hidden",
              sm && "size-8 rounded-full border-border/60",
            )}
          >
            {theme === "light" ? (
              <Sun className="h-4 w-4" />
            ) : theme === "system" ? (
              <Monitor className="h-4 w-4" />
            ) : (
              <MoonStar className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun className="h-4 w-4 mr-2" />
            Light
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Monitor className="h-4 w-4 mr-2" />
            System
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <MoonStar className="h-4 w-4 mr-2" />
            Dark
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="hidden sm:inline-flex items-center gap-1 rounded-full bg-muted p-0.5 border border-border">
        <Button
          onClick={() => setTheme("light")}
          variant="ghost"
          size="icon"
          className={`rounded-full h-8 w-8 transition-colors ${
            theme === "light"
              ? "bg-accent-foreground/60 text-background/80 hover:text-background/80 hover:bg-accent-foreground/60 dark:hover:bg-background"
              : "text-accent-foreground/80 hover:text-accent-foreground hover:bg-muted-foreground/60 dark:hover:bg-background/60"
          }`}
          aria-label="Light mode"
          aria-pressed={theme === "light"}
        >
          <Sun className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => setTheme("system")}
          variant="ghost"
          size="icon"
          className={`rounded-full h-8 w-8 transition-colors ${
            theme === "system"
              ? "bg-background text-foreground hover:bg-background dark:hover:bg-background"
              : "text-accent-foreground/80 hover:text-accent-foreground hover:bg-muted-foreground/60 dark:hover:bg-background/60"
          }`}
          aria-label="System mode"
          aria-pressed={theme === "system"}
        >
          <Monitor className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => setTheme("dark")}
          variant="ghost"
          size="icon"
          className={`rounded-full h-8 w-8 transition-colors ${
            theme === "dark"
              ? "bg-background text-foreground hover:bg-background dark:hover:bg-background"
              : "text-accent-foreground/80 hover:text-accent-foreground hover:bg-muted-foreground/60 dark:hover:bg-background/60"
          }`}
          aria-label="Dark mode"
          aria-pressed={theme === "dark"}
        >
          <MoonStar className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
