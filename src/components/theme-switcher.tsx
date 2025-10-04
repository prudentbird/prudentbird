"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Sun, Monitor, MoonStar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const currentTheme = mounted ? theme : "system";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="sm:hidden">
            {currentTheme === "light" ? (
              <Sun className="h-4 w-4" />
            ) : currentTheme === "system" ? (
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
            currentTheme === "light"
              ? "bg-accent-foreground/60 text-background/80 hover:text-background/80 hover:bg-accent-foreground/60 dark:hover:bg-background"
              : "text-accent-foreground/80 hover:text-accent-foreground hover:bg-muted-foreground/60 dark:hover:bg-background/60"
          }`}
          aria-label="Light mode"
          aria-pressed={currentTheme === "light"}
        >
          <Sun className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => setTheme("system")}
          variant="ghost"
          size="icon"
          className={`rounded-full h-8 w-8 transition-colors ${
            currentTheme === "system"
              ? "bg-background text-foreground hover:bg-background dark:hover:bg-background"
              : "text-accent-foreground/80 hover:text-accent-foreground hover:bg-muted-foreground/60 dark:hover:bg-background/60"
          }`}
          aria-label="System mode"
          aria-pressed={currentTheme === "system"}
        >
          <Monitor className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => setTheme("dark")}
          variant="ghost"
          size="icon"
          className={`rounded-full h-8 w-8 transition-colors ${
            currentTheme === "dark"
              ? "bg-background text-foreground hover:bg-background dark:hover:bg-background"
              : "text-accent-foreground/80 hover:text-accent-foreground hover:bg-muted-foreground/60 dark:hover:bg-background/60"
          }`}
          aria-label="Dark mode"
          aria-pressed={currentTheme === "dark"}
        >
          <MoonStar className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
