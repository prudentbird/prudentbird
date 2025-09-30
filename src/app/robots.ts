import { env } from "~/env";
import type { MetadataRoute } from "next";

const baseUrl = env.BASE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/favicon.ico",
          "/manifest.json",
          "/*.jpg$",
          "/*.jpeg$",
          "/*.png$",
          "/*.gif$",
          "/*.webp$",
          "/*.svg$",
          "/*.ico$",
          "/*.pdf$",
        ],
        disallow: ["/_next/", "/api/", "/_error", "/_middleware", "/_api/"],
        crawlDelay: 10,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl.replace(/^https?:\/\//, ""),
  };
}
