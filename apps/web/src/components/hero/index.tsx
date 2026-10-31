"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const VoxelAvatar = dynamic(() => import("./voxel-avatar"), { ssr: false });

function useIdleAfterLoad() {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let cancel = () => {};
    const schedule = () => {
      if ("requestIdleCallback" in window) {
        const id = requestIdleCallback(() => setIdle(true), { timeout: 2000 });
        cancel = () => cancelIdleCallback(id);
      } else {
        const id = setTimeout(() => setIdle(true), 200);
        cancel = () => clearTimeout(id);
      }
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      cancel();
    };
  }, []);
  return idle;
}

export function VoxelAvatarHero({ className }: { className?: string }) {
  return useIdleAfterLoad() ? <VoxelAvatar className={className} /> : null;
}

export { default as PhotoStackHero } from "./photo-stack";
