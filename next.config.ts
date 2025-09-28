import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    cacheComponents: true,
    browserDebugInfoInTerminal: true,
  },
};

export default nextConfig;
