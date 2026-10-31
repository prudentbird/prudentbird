import { z } from "zod/v4";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["local", "test", "development", "staging", "production"])
      .default("development"),
    BASE_URL: z.url(),
    LASTFM_API_KEY: z.string(),
    LASTFM_USERNAME: z.string(),
    SPOTIFY_CLIENT_ID: z.string(),
    SPOTIFY_CLIENT_SECRET: z.string(),
    SPOTIFY_REFRESH_TOKEN: z.string(),
    // Optional: without it, "Listen with me" quietly reports no match.
    YOUTUBE_API_KEY: z.string().optional(),
  },
  emptyStringAsUndefined: true,
  experimental__runtimeEnv: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
