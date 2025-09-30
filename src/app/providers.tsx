"use client";

import { ThemeProvider } from "~/components/theme";
import { Analytics } from "@vercel/analytics/next";
import { ReactNode, useEffect, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const Providers = ({ children }: { children: ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestIdleCallback
      ? requestIdleCallback(() => setMounted(true))
      : setTimeout(() => setMounted(true), 0);
    return () => {
      if (typeof cancelIdleCallback !== "undefined" && typeof id === "number") {
        cancelIdleCallback(id);
      } else if (typeof id === "number") {
        clearTimeout(id);
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
