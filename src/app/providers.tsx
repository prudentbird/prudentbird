"use client";

import { ThemeProvider } from "~/components/theme";
import { Analytics } from "@vercel/analytics/next";
import { ReactNode, useEffect, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";

type IdleDeadlineLike = { didTimeout: boolean; timeRemaining: () => number };
type IdleRequestCallback = (deadline: IdleDeadlineLike) => void;
type IdleRequestOptions = { timeout?: number };
type SafeWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (id: number) => void;
};

const Providers = ({ children }: { children: ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    if (typeof window !== "undefined") {
      const w = window as SafeWindow;
      if (typeof w.requestIdleCallback === "function") {
        idleId = w.requestIdleCallback(() => setMounted(true));
      } else {
        timeoutId = window.setTimeout(() => setMounted(true), 0);
      }
    } else {
      timeoutId = null;
    }

    return () => {
      if (idleId != null && typeof window !== "undefined") {
        const w = window as SafeWindow;
        if (typeof w.cancelIdleCallback === "function") {
          w.cancelIdleCallback(idleId);
        }
      }
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <ThemeProvider
      enableSystem
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
    >
      {children}
      {mounted ? (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      ) : null}
    </ThemeProvider>
  );
};

export default Providers;
