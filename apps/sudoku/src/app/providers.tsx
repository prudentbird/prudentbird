"use client";

import { env } from "~/env";
import { type ReactNode } from "react";
import { authClient } from "~/lib/auth-client";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "~/components/theme";
import { GuestSync } from "~/components/guest-sync";
import {
  ConvexBetterAuthProvider,
  type AuthClient,
} from "@convex-dev/better-auth/react";

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      enableSystem
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
    >
      <ConvexBetterAuthProvider
        client={convex}
        authClient={authClient as unknown as AuthClient}
      >
        <GuestSync />
        {children}
      </ConvexBetterAuthProvider>
    </ThemeProvider>
  );
}
