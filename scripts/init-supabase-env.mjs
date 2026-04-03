import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildEnvInitPlan, ENV_FILE_MAPPINGS } from "./lib/supabase-env-files.mjs";

const cwd = process.cwd();
const dryRun = process.argv.includes("--dry-run");

let createdCount = 0;
const plan = buildEnvInitPlan(ENV_FILE_MAPPINGS, (relativePath) => existsSync(resolve(cwd, relativePath)));

console.log(dryRun ? "Supabase env init (dry run)" : "Supabase env init");
console.log("==================");

for (const item of plan) {
  if (item.status === "skip") {
    console.log(`[SKIP] ${item.label}`);
    console.log(`       ${item.detail}`);
    continue;
  }

  if (item.status === "missing_source") {
    console.log(`[FAIL] ${item.label}`);
    console.log(`       ${item.detail}`);
    process.exitCode = 1;
    continue;
  }

  if (!dryRun && item.source) {
    copyFileSync(resolve(cwd, item.source), resolve(cwd, item.target));
  }

  createdCount += 1;
  console.log(dryRun ? `[PLAN] ${item.label}` : `[OK] ${item.label}`);
  console.log(`       ${item.detail}`);
}

console.log("");
console.log(
  dryRun
    ? `Summary: ${createdCount} file(s) would be created.`
    : `Summary: ${createdCount} file(s) created.`,
);

if (!dryRun) {
  console.log("Next step: fill the placeholder values before running Supabase commands.");
}
