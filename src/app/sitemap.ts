import { env } from "~/env";
import type { MetadataRoute } from "next";

const baseUrl = env.BASE_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      priority: 1.0,
      lastModified: new Date(),
      changeFrequency: "never",
    },
  ];
}
