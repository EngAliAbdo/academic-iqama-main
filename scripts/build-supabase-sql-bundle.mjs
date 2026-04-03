import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { analyzeMigrationFilenames, getMigrationIssues } from "./lib/supabase-migrations.mjs";
import { buildSupabaseSqlBundle } from "./lib/supabase-sql-bundle.mjs";

const cwd = process.cwd();
const migrationsDir = resolve(cwd, "supabase/migrations");
const outputFile = resolve(cwd, "supabase/manual-deploy.sql");

const fileNames = readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right));

const summary = analyzeMigrationFilenames(fileNames);
const issues = getMigrationIssues(summary);

if (issues.length > 0) {
  console.error("Cannot build Supabase SQL bundle:");
  for (const issue of issues) {
    console.error("- " + issue);
  }
  process.exit(1);
}

const migrations = fileNames.map((fileName) => ({
  fileName,
  sql: readFileSync(resolve(migrationsDir, fileName), "utf8"),
}));

const bundle = buildSupabaseSqlBundle(migrations, {
  sourceDir: "supabase/migrations",
});

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, bundle, "utf8");

console.log(`Wrote ${fileNames.length} migration(s) to ${outputFile}`);
