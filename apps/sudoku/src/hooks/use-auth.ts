import { useConvexAuth } from "convex/react";
import { authClient } from "~/lib/auth-client";

export function useAuth() {
  const auth = useConvexAuth();
  const { data: session, isPending } = authClient.useSession();

  return {
    ...auth,
    isLoading:
      auth.isLoading ||
      isPending ||
      (Boolean(session) && !auth.isAuthenticated),
  };
}
