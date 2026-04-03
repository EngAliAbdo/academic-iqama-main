import { describe, expect, it } from "vitest";

import {
  ANALYZE_SUBMISSION_ARTIFACT_PATHS,
  analyzeFunctionArtifacts,
  getFunctionArtifactIssues,
} from "../../scripts/lib/supabase-function-artifacts.mjs";

describe("supabase function artifact helpers", () => {
  it("accepts a complete analyze-submission function directory", () => {
    const existingPaths = new Set(ANALYZE_SUBMISSION_ARTIFACT_PATHS);
    const summary = analyzeFunctionArtifacts(
      "analyze-submission",
      ANALYZE_SUBMISSION_ARTIFACT_PATHS,
      (relativePath) => existingPaths.has(relativePath),
    );

    expect(summary).toEqual({
      functionName: "analyze-submission",
      requiredCount: 4,
      availableCount: 4,
      missingPaths: [],
    });

    expect(getFunctionArtifactIssues(summary)).toEqual([]);
  });

  it("reports missing function files clearly", () => {
    const summary = analyzeFunctionArtifacts(
      "analyze-submission",
      ANALYZE_SUBMISSION_ARTIFACT_PATHS,
      (relativePath) =>
        relativePath === "supabase/functions/analyze-submission"
        || relativePath === "supabase/functions/analyze-submission/index.ts",
    );

    expect(summary).toEqual({
      functionName: "analyze-submission",
      requiredCount: 4,
      availableCount: 2,
      missingPaths: [
        "supabase/functions/analyze-submission/README.md",
        "supabase/functions/analyze-submission/request.example.json",
      ],
    });

    expect(getFunctionArtifactIssues(summary)).toEqual([
      "missing paths: supabase/functions/analyze-submission/README.md, supabase/functions/analyze-submission/request.example.json",
    ]);
  });
});
