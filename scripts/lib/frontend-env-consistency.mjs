import fs from "node:fs";
import path from "node:path";

import {
  extractProjectIdFromJwt,
  extractProjectIdFromUrl,
  isPlaceholder,
  parseEnvContent,
} from "./supabase-preflight.mjs";

function loadFrontendEnvFile(rootDir, fileName) {
  const filePath = path.join(rootDir, fileName);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return parseEnvContent(fs.readFileSync(filePath, "utf8"));
}

function normalizeRealValue(value) {
  const normalized = value?.trim();

  if (!normalized || isPlaceholder(normalized)) {
    return null;
  }

  return normalized;
}

function getEnvProjectRefs(values) {
  const projectId = normalizeRealValue(values.VITE_SUPABASE_PROJECT_ID);
  const url = normalizeRealValue(values.VITE_SUPABASE_URL);
  const publishableKey = normalizeRealValue(values.VITE_SUPABASE_PUBLISHABLE_KEY);

  return {
    projectId,
    urlProjectId: url ? extractProjectIdFromUrl(url) : null,
    publishableKeyProjectId: publishableKey ? extractProjectIdFromJwt(publishableKey) : null,
  };
}

function compareRef(issues, label, baseValue, localValue) {
  if (baseValue && localValue && baseValue !== localValue) {
    issues.push(`${label} differs between .env and .env.local`);
  }
}

export function getFrontendEnvConsistencyIssues(rootDir) {
  const baseValues = loadFrontendEnvFile(rootDir, ".env");
  const localValues = loadFrontendEnvFile(rootDir, ".env.local");

  if (!baseValues || !localValues) {
    return [];
  }

  const baseRefs = getEnvProjectRefs(baseValues);
  const localRefs = getEnvProjectRefs(localValues);
  const issues = [];

  compareRef(
    issues,
    "VITE_SUPABASE_PROJECT_ID",
    baseRefs.projectId,
    localRefs.projectId,
  );
  compareRef(
    issues,
    "VITE_SUPABASE_URL host",
    baseRefs.urlProjectId,
    localRefs.urlProjectId,
  );
  compareRef(
    issues,
    "VITE_SUPABASE_PUBLISHABLE_KEY ref",
    baseRefs.publishableKeyProjectId,
    localRefs.publishableKeyProjectId,
  );

  return issues;
}

export function assertFrontendEnvConsistency(rootDir) {
  const issues = getFrontendEnvConsistencyIssues(rootDir);

  if (issues.length === 0) {
    return;
  }

  throw new Error(
    [
      "Conflicting frontend Supabase env values detected between .env and .env.local.",
      ...issues.map((issue) => `- ${issue}`),
      "Keep .env as placeholders/shared defaults and store the real local project values in .env.local.",
    ].join("\n"),
  );
}
