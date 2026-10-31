"use client";

import { type ReactNode } from "react";
import { LazyMotion } from "motion/react";
import { ThemeProvider } from "~/components/theme";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const loadMotionFeatures = () =>
  import("~/lib/motion-features").then((mod) => mod.default);

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      enableSystem
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
    >
      <LazyMotion features={loadMotionFeatures} strict>
        {children}
      </LazyMotion>
      <Analytics />
      <SpeedInsights />
    </ThemeProvider>
  );
}
