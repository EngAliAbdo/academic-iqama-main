export function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

export function parseEnvContent(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    values[key] = value;
  }

  return values;
}

export function isPlaceholder(value) {
  if (!value) {
    return true;
  }

  const normalized = value.toLowerCase();
  return (
    normalized.includes("your-")
    || normalized.includes("your_")
    || normalized.includes("example")
    || normalized.includes("placeholder")
  );
}

export function analyzeEnvValues(values, requiredKeys) {
  return {
    missingKeys: requiredKeys.filter((key) => !values[key]),
    placeholderKeys: requiredKeys.filter((key) => values[key] && isPlaceholder(values[key])),
  };
}

export function extractProjectIdFromUrl(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const [subdomain] = url.hostname.split(".");
    return subdomain || null;
  } catch {
    return null;
  }
}

export function extractProjectIdFromJwt(value) {
  if (!value) {
    return null;
  }

  try {
    const [, payload] = value.split(".");
    if (!payload) {
      return null;
    }

    const parsed = JSON.parse(decodeBase64Url(payload));
    return typeof parsed.ref === "string" ? parsed.ref : null;
  } catch {
    return null;
  }
}

export function getProjectConsistencyMismatches({
  configProjectId,
  frontendProjectId,
  frontendUrl,
  publishableKey,
  functionUrl,
}) {
  if (!configProjectId) {
    return [];
  }

  const mismatches = [];
  const frontendUrlProjectId = extractProjectIdFromUrl(frontendUrl);
  const anonKeyProjectId = extractProjectIdFromJwt(publishableKey);
  const functionUrlProjectId = extractProjectIdFromUrl(functionUrl);

  if (frontendProjectId && frontendProjectId !== configProjectId) {
    mismatches.push("config.toml project_id does not match VITE_SUPABASE_PROJECT_ID");
  }

  if (frontendUrlProjectId && frontendUrlProjectId !== configProjectId) {
    mismatches.push("config.toml project_id does not match VITE_SUPABASE_URL host");
  }

  if (anonKeyProjectId && anonKeyProjectId !== configProjectId) {
    mismatches.push("config.toml project_id does not match VITE_SUPABASE_PUBLISHABLE_KEY ref");
  }

  if (functionUrlProjectId && functionUrlProjectId !== configProjectId) {
    mismatches.push("config.toml project_id does not match function SUPABASE_URL host");
  }

  return mismatches;
}
