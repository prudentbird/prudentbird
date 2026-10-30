import "./src/env";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["trustworthy-guineapig.outray.app"],
  typedRoutes: true,
  reactCompiler: true,
  cacheComponents: true,
  partialPrefetching: true,
  logging: {
    browserToTerminal: true,
  },
  experimental: {
    typedEnv: true,
    turbopackFileSystemCacheForDev: true,
    turbopackFileSystemCacheForBuild: true,
    optimizePackageImports: ["lucide-react", "motion"],
  },
  images: {
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Link",
            value:
              '</sitemap.xml>; rel="sitemap", </index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"',
          },
        ],
      },
      {
        source: "/:path(index.md|llms.txt|llms-full.txt)",
        headers: [
          { key: "Content-Type", value: "text/markdown; charset=utf-8" },
          { key: "Vary", value: "Accept, Accept-Encoding" },
        ],
      },
    ];
  },
};

export default nextConfig;
