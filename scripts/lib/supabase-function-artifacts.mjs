export const ANALYZE_SUBMISSION_ARTIFACT_PATHS = [
  "supabase/functions/analyze-submission",
  "supabase/functions/analyze-submission/index.ts",
  "supabase/functions/analyze-submission/README.md",
  "supabase/functions/analyze-submission/request.example.json",
];

export function analyzeFunctionArtifacts(functionName, requiredPaths, exists) {
  const missingPaths = requiredPaths.filter((relativePath) => !exists(relativePath));

  return {
    functionName,
    requiredCount: requiredPaths.length,
    availableCount: requiredPaths.length - missingPaths.length,
    missingPaths,
  };
}

export function getFunctionArtifactIssues(summary) {
  if (summary.missingPaths.length === 0) {
    return [];
  }

  return [`missing paths: ${summary.missingPaths.join(", ")}`];
}
