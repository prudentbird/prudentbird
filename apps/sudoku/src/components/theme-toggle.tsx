"use client";

import { useTheme } from "next-themes";
import { useMounted } from "~/hooks/use-mounted";
import { track } from "~/lib/analytics";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => {
        const next = isDark ? "light" : "dark";
        setTheme(next);
        track("theme_toggled", { theme: next });
      }}
      className="cursor-pointer text-sm text-muted-foreground/80 underline-offset-2 transition-colors hover:text-foreground hover:underline"
    >
      {mounted ? (isDark ? "Light" : "Dark") : "Theme"}
    </button>
  );
}
