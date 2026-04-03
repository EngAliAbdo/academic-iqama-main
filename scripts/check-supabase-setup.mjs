import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  analyzeEnvValues,
  extractProjectIdFromJwt,
  extractProjectIdFromUrl,
  getProjectConsistencyMismatches,
  parseEnvContent,
} from "./lib/supabase-preflight.mjs";
import {
  getSupabaseConfigIssues,
  parseSupabaseConfigSummary,
} from "./lib/supabase-config.mjs";
import {
  normalizePreflightMode,
  SUPPORTED_PREFLIGHT_MODES,
} from "./lib/supabase-check-modes.mjs";
import {
  analyzeMigrationFilenames,
  getMigrationIssues,
} from "./lib/supabase-migrations.mjs";
import {
  analyzeSchemaArtifacts,
  getSchemaArtifactIssues,
} from "./lib/supabase-schema-artifacts.mjs";
import {
  ANALYZE_SUBMISSION_ARTIFACT_PATHS,
  analyzeFunctionArtifacts,
  getFunctionArtifactIssues,
} from "./lib/supabase-function-artifacts.mjs";

const cwd = process.cwd();
const rawMode = process.argv[2];
const mode = normalizePreflightMode(rawMode);
const checks = [];

if (!mode) {
  console.error(`Unsupported preflight mode: ${rawMode}`);
  console.error(`Supported modes: ${SUPPORTED_PREFLIGHT_MODES.join(", ")}`);
  process.exit(1);
}

function addCheck(name, ok, details) {
  checks.push({ name, ok, details });
}

function readEnvFile(relativePath) {
  const absolutePath = resolve(cwd, relativePath);
  if (!existsSync(absolutePath)) {
    return null;
  }

  const content = readFileSync(absolutePath, "utf8");
  return parseEnvContent(content);
}

function readConfigProjectId() {
  const configPath = resolve(cwd, "supabase/config.toml");
  if (!existsSync(configPath)) {
    return null;
  }

  const config = readFileSync(configPath, "utf8");
  return parseSupabaseConfigSummary(config).projectId;
}

function validateEnvFile(label, candidatePaths, requiredKeys, setupHint) {
  const existingPath = candidatePaths.find((candidatePath) => existsSync(resolve(cwd, candidatePath)));

  if (!existingPath) {
    addCheck(label, false, setupHint);
    return;
  }

  const values = readEnvFile(existingPath);

  if (!values) {
    addCheck(label, false, setupHint);
    return;
  }

  const { missingKeys, placeholderKeys } = analyzeEnvValues(values, requiredKeys);

  if (missingKeys.length === 0 && placeholderKeys.length === 0) {
    addCheck(label, true, `Using ${existingPath} with ${requiredKeys.length} required values.`);
    return;
  }

  const issues = [];
  if (missingKeys.length > 0) {
    issues.push(`missing: ${missingKeys.join(", ")}`);
  }
  if (placeholderKeys.length > 0) {
    issues.push(`replace placeholder values: ${placeholderKeys.join(", ")}`);
  }

  addCheck(label, false, `${existingPath} | ${issues.join(" | ")}`);
}

function getExecutableCandidates(name) {
  if (name === "docker") {
    return process.platform === "win32"
      ? [
          "docker",
          "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
        ]
      : ["docker"];
  }

  if (name === "supabase") {
    return process.platform === "win32"
      ? [
          "supabase",
          "node_modules/.bin/supabase.cmd",
          "tools/supabase-cli/supabase.exe",
          "node_modules/supabase/bin/supabase.exe",
        ]
      : [
          "supabase",
          "node_modules/.bin/supabase",
          "tools/supabase-cli/supabase",
          "node_modules/supabase/bin/supabase",
        ];
  }

  return [name];
}

function resolveExecutableCandidate(candidate) {
  if (!candidate.includes("/") && !candidate.includes("\\") && !candidate.includes(":")) {
    return { command: candidate, shell: process.platform === "win32", display: candidate };
  }

  const absolutePath = resolve(cwd, candidate);
  if (!existsSync(absolutePath)) {
    return null;
  }

  return { command: absolutePath, shell: false, display: absolutePath };
}

function tryExecutable(name, args) {
  for (const candidate of getExecutableCandidates(name)) {
    const resolved = resolveExecutableCandidate(candidate);
    if (!resolved) {
      continue;
    }

    const result = spawnSync(resolved.command, args, {
      cwd,
      encoding: "utf8",
      shell: resolved.shell,
    });

    if (result.status === 0) {
      return { ok: true, result, display: resolved.display };
    }
  }

  return { ok: false };
}

function validateSupabaseCli() {
  const lookup = tryExecutable("supabase", ["--version"]);

  if (lookup.ok) {
    addCheck("Supabase CLI", true, lookup.result.stdout.trim() || `Installed via ${lookup.display}`);
    return;
  }

  addCheck("Supabase CLI", false, "Not found in PATH. Install the Supabase CLI before serve/deploy.");
}

function validateDocker() {
  const windowsDockerPath = "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";

  if (process.platform === "win32" && existsSync(windowsDockerPath)) {
    addCheck("Docker", true, `Detected Docker Desktop at ${windowsDockerPath}.`);
    return;
  }

  if (process.platform === "win32") {
    const powershellResult = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-Command", "docker --version"],
      {
        cwd,
        encoding: "utf8",
        shell: false,
      },
    );

    if (powershellResult.status === 0) {
      addCheck("Docker", true, powershellResult.stdout.trim() || "Installed");
      return;
    }
  }

  const lookup = tryExecutable("docker", ["--version"]);

  if (lookup.ok) {
    addCheck("Docker", true, lookup.result.stdout.trim() || `Installed via ${lookup.display}`);
    return;
  }

  addCheck("Docker", false, "Not found in PATH. Supabase local start requires Docker Desktop or a compatible Docker runtime.");
}

function validateConfig() {
  const configPath = resolve(cwd, "supabase/config.toml");
  if (!existsSync(configPath)) {
    addCheck("supabase/config.toml", false, "Missing Supabase config file.");
    return;
  }

  const config = readFileSync(configPath, "utf8");
  const summary = parseSupabaseConfigSummary(config);
  const issues = getSupabaseConfigIssues(summary);

  if (issues.length === 0) {
    addCheck("supabase/config.toml", true, "project_id and analyze-submission runtime config are present.");
    return;
  }

  addCheck("supabase/config.toml", false, issues.join(" | "));
}

function validateProjectConsistency() {
  const configProjectId = readConfigProjectId();
  const frontendEnvPath = [".env.local", ".env"].find((candidatePath) => existsSync(resolve(cwd, candidatePath)));

  if (!configProjectId || !frontendEnvPath) {
    return;
  }

  const frontendEnv = readEnvFile(frontendEnvPath);
  if (!frontendEnv) {
    return;
  }

  const frontendProjectId = frontendEnv.VITE_SUPABASE_PROJECT_ID;
  const functionEnvPath = ["supabase/.env.local", "supabase/.env"].find((candidatePath) =>
    existsSync(resolve(cwd, candidatePath))
  );
  const functionEnv = functionEnvPath ? readEnvFile(functionEnvPath) : null;
  const mismatches = getProjectConsistencyMismatches({
    configProjectId,
    frontendProjectId,
    frontendUrl: frontendEnv.VITE_SUPABASE_URL,
    publishableKey: frontendEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
    functionUrl: functionEnv?.SUPABASE_URL,
  });

  if (mismatches.length === 0) {
    addCheck("Supabase project consistency", true, "config.toml, frontend env, and available Supabase refs are aligned.");
    return;
  }

  addCheck("Supabase project consistency", false, mismatches.join(" | "));
}

function validateMigrations() {
  const migrationsPath = resolve(cwd, "supabase/migrations");

  if (!existsSync(migrationsPath)) {
    addCheck("Supabase migrations", false, "Missing supabase/migrations directory.");
    return;
  }

  const fileNames = readdirSync(migrationsPath).filter((fileName) => fileName.endsWith(".sql"));
  const summary = analyzeMigrationFilenames(fileNames);
  const issues = getMigrationIssues(summary);

  if (issues.length === 0) {
    addCheck(
      "Supabase migrations",
      true,
      `${summary.totalCount} migration file(s) found. Latest: ${summary.latestMigration}.`,
    );
    return;
  }

  addCheck("Supabase migrations", false, issues.join(" | "));
}

function validateSchemaArtifacts() {
  const migrationsPath = resolve(cwd, "supabase/migrations");

  if (!existsSync(migrationsPath)) {
    addCheck("Supabase schema artifacts", false, "Missing supabase/migrations directory.");
    return;
  }

  const migrationFileNames = readdirSync(migrationsPath)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));
  const migrationContents = migrationFileNames.map((fileName) =>
    readFileSync(resolve(migrationsPath, fileName), "utf8")
  );
  const summary = analyzeSchemaArtifacts(migrationContents);
  const issues = getSchemaArtifactIssues(summary);

  if (issues.length === 0) {
    addCheck(
      "Supabase schema artifacts",
      true,
      "Required tables, storage buckets, and RPC functions are present in the local migrations.",
    );
    return;
  }

  addCheck("Supabase schema artifacts", false, issues.join(" | "));
}

function validateFunctionArtifacts() {
  const summary = analyzeFunctionArtifacts(
    "analyze-submission",
    ANALYZE_SUBMISSION_ARTIFACT_PATHS,
    (relativePath) => existsSync(resolve(cwd, relativePath)),
  );
  const issues = getFunctionArtifactIssues(summary);

  if (issues.length === 0) {
    addCheck(
      "Supabase function artifacts",
      true,
      `${summary.availableCount}/${summary.requiredCount} analyze-submission paths are present.`,
    );
    return;
  }

  addCheck("Supabase function artifacts", false, issues.join(" | "));
}

if (mode !== "repo") {
  validateSupabaseCli();
}

if (mode === "start") {
  validateDocker();
}

if (mode !== "cli") {
  validateConfig();
  validateProjectConsistency();
}

if (mode === "full" || mode === "repo" || mode === "db") {
  validateMigrations();
  validateSchemaArtifacts();
}

if (mode === "full" || mode === "repo" || mode === "function" || mode === "serve" || mode === "deploy") {
  validateFunctionArtifacts();
}

if (mode === "full" || mode === "frontend" || mode === "serve") {
  validateEnvFile(
    "Frontend env",
    [".env.local", ".env"],
    [
      "VITE_SUPABASE_PROJECT_ID",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_URL",
    ],
    "Missing frontend env file. Create .env or .env.local from .env.example or .env.local.example.",
  );
}

if (mode === "full" || mode === "function" || mode === "serve") {
  validateEnvFile(
    "Function env",
    ["supabase/.env.local", "supabase/.env"],
    [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "GEMINI_API_KEY",
      "GEMINI_MODEL",
    ],
    "Missing function env file. Create supabase/.env.local from supabase/.env.example or supabase/.env.local.example.",
  );
}

const failedChecks = checks.filter((check) => !check.ok);
const passedChecks = checks.length - failedChecks.length;

console.log("Supabase setup preflight");
console.log("=======================");

for (const check of checks) {
  const marker = check.ok ? "[OK]" : "[FAIL]";
  console.log(`${marker} ${check.name}`);
  console.log(`       ${check.details}`);
}

console.log("");
console.log(`Summary: ${passedChecks}/${checks.length} checks passed`);

if (failedChecks.length > 0) {
  console.log("Next steps:");

  if (failedChecks.some((check) => check.name === "Supabase CLI")) {
    console.log("- Install the Supabase CLI.");
  }

  if (failedChecks.some((check) => check.name === "Docker")) {
    console.log("- Install and start Docker Desktop before running `supabase start`.");
  }

  if (failedChecks.some((check) => check.name === "Frontend env")) {
    console.log("- Run `npm run supabase:env:init` or create .env/.env.local from the example files, then fill frontend Supabase settings.");
  }

  if (failedChecks.some((check) => check.name === "Function env")) {
    console.log("- Run `npm run supabase:env:init` or create supabase/.env.local manually, then add function secrets.");
  }

  if (failedChecks.some((check) => check.name === "Supabase project consistency")) {
    console.log("- Align supabase/config.toml with the frontend URL, project id, and publishable key before using Supabase commands.");
  }

  if (failedChecks.some((check) => check.name === "Supabase migrations")) {
    console.log("- Ensure supabase/migrations exists, filenames follow the 12-digit timestamp pattern, and no version is duplicated.");
  }

  if (failedChecks.some((check) => check.name === "Supabase schema artifacts")) {
    console.log("- Ensure the migrations still define the required tables, storage buckets, and accessible RPC functions used by the app.");
  }

  if (failedChecks.some((check) => check.name === "Supabase function artifacts")) {
    console.log("- Ensure supabase/functions/analyze-submission includes index.ts, README.md, and request.example.json before serve/deploy.");
  }

  process.exitCode = 1;
}
