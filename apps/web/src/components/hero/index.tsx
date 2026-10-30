"use client";

import dynamic from "next/dynamic";

// The 3D hero loads in the browser; photo frames render with the page.
export const VoxelAvatarHero = dynamic(() => import("./voxel-avatar"), {
  ssr: false,
});
export { default as PhotoStackHero } from "./photo-stack";
