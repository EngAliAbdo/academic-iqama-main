import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { FUNCTION_ENV_CANDIDATES, selectFunctionEnvFile } from "./lib/supabase-env-files.mjs";

const cwd = process.cwd();
const selectedEnvFile = selectFunctionEnvFile(
  FUNCTION_ENV_CANDIDATES,
  (relativePath) => existsSync(resolve(cwd, relativePath)),
);

if (!selectedEnvFile) {
  console.error("Missing function env file. Run `npm run supabase:env:init` or create supabase/.env.local from the example files.");
  process.exit(1);
}

const result = spawnSync(
  "supabase",
  ["functions", "serve", "analyze-submission", "--env-file", selectedEnvFile],
  {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
