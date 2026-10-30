"use client";

import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import { externalProps } from "~/lib/content";
import { RetailyticsState } from "./retailytics-state";
import { work } from "~/components/home/work";

/**
 * Calls `step` every `ms` while `active`; the step returns the next delay or
 * nothing. The first call waits `first` ms, so a finished state shows first.
 */
function useLoop(
  active: boolean,
  ms: number,
  step: () => number | void,
  first = ms,
) {
  const latest = useRef(step);
  useEffect(() => {
    latest.current = step;
  });
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = (delay: number) => {
      timer = setTimeout(() => tick(latest.current() ?? ms), delay);
    };
    tick(first);
    return () => clearTimeout(timer);
  }, [active, ms, first]);
}

/* ── Voxx: edit a passage in the repo and watch the published page update ── */
const DOC_PASSAGES = [
  { prefix: "# ", versions: ["Hello World", "Hello There"] },
  {
    prefix: "",
    versions: ["Our blog lives in the repo.", "Every post starts with a PR."],
  },
  {
    prefix: "- ",
    versions: ["Writing beside the code", "Review before publishing"],
  },
  {
    prefix: "- ",
    versions: ["Publish when you merge", "Ship posts like code"],
  },
  {
    prefix: "- ",
    versions: ["RSS and sitemap included", "Social previews built in"],
  },
] as const;

function parseDoc(text: string) {
  const lines = text.split("\n");
  const tags = /tags:\s*\[([^\]]*)\]?/.exec(text)?.[1];
  const end = lines.indexOf("---", 1);
  const body = end > 0 ? lines.slice(end + 1) : [];
  return {
    tags: tags
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    body,
  };
}

