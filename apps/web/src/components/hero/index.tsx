"use client";

import dynamic from "next/dynamic";

export const VoxelAvatarHero = dynamic(() => import("./voxel-avatar"), {
  ssr: false,
});
export { default as PhotoStackHero } from "./photo-stack";
