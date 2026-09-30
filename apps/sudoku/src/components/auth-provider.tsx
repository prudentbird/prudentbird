"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ConvexProviderWithAuth,
  useConvexAuth,
  type ConvexReactClient,
} from "convex/react";
import { authClient } from "~/lib/auth-client";

function useBetterAuth(retryVersion: number) {
  const { data: session, isPending } = authClient.useSession();
  const sessionId = session?.session.id;
  const attempt = useMemo(
    () => ({ sessionId, retryVersion }),
    [sessionId, retryVersion],
  );
  const fetchAccessToken = useCallback(async () => {
    if (!attempt.sessionId) return null;
    try {
      const { data } = await authClient.convex.token();
      return data?.token ?? null;
    } catch {
      return null;
    }
  }, [attempt]);

  return {
    isLoading: isPending,
    isAuthenticated: Boolean(sessionId),
    fetchAccessToken,
  };
}

export function AuthProvider({
  client,
  children,
}: {
  client: ConvexReactClient;
  children: ReactNode;
}) {
  const [retryVersion, setRetryVersion] = useState(0);
  const retry = useCallback(
    () => setRetryVersion((version) => version + 1),
    [],
  );

  const useAuth = useCallback(
    function useAuth() {
      return useBetterAuth(retryVersion);
    },
    [retryVersion],
  );

  return (
    <ConvexProviderWithAuth client={client} useAuth={useAuth}>
      <AuthRecovery retry={retry} />
      {children}
    </ConvexProviderWithAuth>
  );
}

function AuthRecovery({ retry }: { retry: () => void }) {
  const { data: session, refetch } = authClient.useSession();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const sessionId = session?.session.id;

  useEffect(() => {
    if (!sessionId || isAuthenticated || isLoading) return;

    const recover = async () => {
      if (!navigator.onLine) return;
      await refetch();
      retry();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void recover();
    };
    const onOnline = () => void recover();
    const interval = window.setInterval(() => void recover(), 10_000);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionId, isAuthenticated, isLoading, refetch, retry]);

  return null;
}
