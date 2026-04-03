import { describe, expect, it } from "vitest";

import {
  analyzeMigrationFilenames,
  getMigrationIssues,
} from "../../scripts/lib/supabase-migrations.mjs";

describe("supabase migrations helpers", () => {
  it("accepts valid migration filenames and reports the latest file", () => {
    const summary = analyzeMigrationFilenames([
      "202603230001_originality_v1_foundation.sql",
      "202603220001_initial_schema.sql",
      "202603240004_activity_log_analysis_outcomes.sql",
    ]);

    expect(summary).toEqual({
      totalCount: 3,
      invalidNames: [],
      duplicateVersions: [],
      latestMigration: "202603240004_activity_log_analysis_outcomes.sql",
    });
  });

  it("reports invalid names and duplicate migration versions", () => {
    const summary = analyzeMigrationFilenames([
      "202603240001_first.sql",
      "202603240001_second.sql",
      "bad-name.sql",
    ]);

    expect(getMigrationIssues(summary)).toEqual([
      "invalid filenames: bad-name.sql",
      "duplicate versions: 202603240001",
    ]);
  });

  it("reports an empty migrations directory clearly", () => {
    expect(
      getMigrationIssues({
        totalCount: 0,
        invalidNames: [],
        duplicateVersions: [],
        latestMigration: null,
      }),
    ).toEqual(["no migration files found"]);
  });
});
