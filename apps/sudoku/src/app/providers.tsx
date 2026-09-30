"use client";

import { env } from "~/env";
import { type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "~/components/theme";
import { GuestSync } from "~/components/guest-sync";
import { AnalyticsIdentity } from "~/components/analytics";
import { AuthProvider } from "~/components/auth-provider";

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      enableSystem
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
    >
      <AuthProvider client={convex}>
        <AnalyticsIdentity />
        <GuestSync />
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
