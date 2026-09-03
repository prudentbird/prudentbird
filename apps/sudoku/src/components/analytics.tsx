"use client";

import { useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { identify } from "~/lib/analytics";

export function AnalyticsIdentity() {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.getCurrentUser, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (user?._id) identify(user._id);
  }, [user?._id]);

  return null;
}
