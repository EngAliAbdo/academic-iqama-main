import { describe, expect, it } from "vitest";

import {
  getSupabaseConfigIssues,
  parseSupabaseConfigSummary,
} from "../../scripts/lib/supabase-config.mjs";

describe("supabase config helpers", () => {
  it("parses project_id and analyze-submission verify_jwt correctly", () => {
    const summary = parseSupabaseConfigSummary(`
      project_id = "lmqkgbatsfjfsfmmrykb"

      [functions.analyze-submission]
      verify_jwt = true
    `);

    expect(summary).toEqual({
      projectId: "lmqkgbatsfjfsfmmrykb",
      hasAnalyzeSubmissionFunction: true,
      analyzeSubmissionVerifyJwt: true,
    });
  });

  it("accepts verify_jwt = false as a valid explicit runtime setting", () => {
    const summary = parseSupabaseConfigSummary(`
      project_id = "lmqkgbatsfjfsfmmrykb"

      [functions.analyze-submission]
      verify_jwt = false
    `);

    expect(summary).toEqual({
      projectId: "lmqkgbatsfjfsfmmrykb",
      hasAnalyzeSubmissionFunction: true,
      analyzeSubmissionVerifyJwt: false,
    });

    expect(getSupabaseConfigIssues(summary)).toEqual([]);
  });

  it("does not treat other function sections as analyze-submission", () => {
    const summary = parseSupabaseConfigSummary(`
      project_id = "lmqkgbatsfjfsfmmrykb"

      [functions.other-function]
      verify_jwt = true
    `);

    expect(summary).toEqual({
      projectId: "lmqkgbatsfjfsfmmrykb",
      hasAnalyzeSubmissionFunction: false,
      analyzeSubmissionVerifyJwt: null,
    });
  });

  it("reports missing config requirements clearly", () => {
    expect(
      getSupabaseConfigIssues({
        projectId: null,
        hasAnalyzeSubmissionFunction: false,
        analyzeSubmissionVerifyJwt: null,
      }),
    ).toEqual([
      "missing project_id",
      "missing [functions.analyze-submission]",
      "missing verify_jwt setting",
    ]);
  });
});
