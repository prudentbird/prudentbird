"use client";

import type { ReactNode } from "react";
import { useMediaQuery } from "~/lib/use-media-query";

export const DESKTOP = "(min-width: 1024px)";
export const MOBILE = "not all and (min-width: 1024px)";

export function OnMedia({
  query,
  children,
}: {
  query: string;
  children: ReactNode;
}) {
  return useMediaQuery(query) ? children : null;
}
