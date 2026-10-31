import { spawnSync } from "node:child_process";
import { globSync } from "tinyglobby";

const files = globSync("src/**/*.test.{ts,tsx,mts,cts,js,jsx,mjs,cjs}").sort();
if (!files.length) throw new Error("No tests found under src");

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...files],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
