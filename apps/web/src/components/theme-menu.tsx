"use client";

import { Monitor, MoonStar, Sun } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const icon = "size-3.5";

export default function ThemeMenu({
  theme,
  setTheme,
}: {
  theme: string | undefined;
  setTheme: (theme: string, x?: number) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-full border-border/60 sm:hidden"
        >
          {theme === "light" ? (
            <Sun className={icon} />
          ) : theme === "system" ? (
            <Monitor className={icon} />
          ) : (
            <MoonStar className={icon} />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-sound="none">
        <DropdownMenuItem
          onClick={(e) => setTheme("light", e.detail ? e.clientX : undefined)}
        >
          <Sun className="h-4 w-4 mr-2" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => setTheme("system", e.detail ? e.clientX : undefined)}
        >
          <Monitor className="h-4 w-4 mr-2" />
          System
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => setTheme("dark", e.detail ? e.clientX : undefined)}
        >
          <MoonStar className="h-4 w-4 mr-2" />
          Dark
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
