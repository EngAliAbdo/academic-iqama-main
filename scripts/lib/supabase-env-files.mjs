export const ENV_FILE_MAPPINGS = [
  {
    label: "Frontend env",
    target: ".env.local",
    sources: [".env.local.example", ".env.example"],
  },
  {
    label: "Function env",
    target: "supabase/.env.local",
    sources: ["supabase/.env.local.example", "supabase/.env.example"],
  },
];

export const FUNCTION_ENV_CANDIDATES = ["supabase/.env.local", "supabase/.env"];

export function findFirstExistingPath(candidatePaths, exists) {
  return candidatePaths.find((candidatePath) => exists(candidatePath)) ?? null;
}

export function buildEnvInitPlan(mappings, exists) {
  return mappings.map((mapping) => {
    if (exists(mapping.target)) {
      return {
        ...mapping,
        status: "skip",
        source: null,
        detail: `${mapping.target} already exists.`,
      };
    }

    const source = findFirstExistingPath(mapping.sources, exists);

    if (!source) {
      return {
        ...mapping,
        status: "missing_source",
        source: null,
        detail: `No example file found for ${mapping.target}.`,
      };
    }

    return {
      ...mapping,
      status: "create",
      source,
      detail: `${source} -> ${mapping.target}`,
    };
  });
}

export function selectFunctionEnvFile(candidatePaths, exists) {
  return findFirstExistingPath(candidatePaths, exists);
}
