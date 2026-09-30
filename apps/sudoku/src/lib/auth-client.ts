import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [convexClient()],
  sessionOptions: {
    refetchInterval: 60,
  },
});

export const { signIn, signUp, signOut, useSession } = authClient;
