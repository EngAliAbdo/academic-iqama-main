import { describe, expect, it } from "vitest";

import { buildSupabaseSqlBundle } from "../../scripts/lib/supabase-sql-bundle.mjs";

describe("supabase sql bundle builder", () => {
  it("formats migrations into a single ordered SQL bundle", () => {
    const bundle = buildSupabaseSqlBundle([
      {
        fileName: "202603220001_initial_schema.sql",
        sql: "create table profiles(id uuid primary key);",
      },
      {
        fileName: "202603230001_originality_v1_foundation.sql",
        sql: "create table originality_checks(id uuid primary key);",
      },
    ]);

    expect(bundle).toContain("-- Supabase manual deployment bundle");
    expect(bundle).toContain("-- Migration: 202603220001_initial_schema.sql");
    expect(bundle).toContain("-- Migration: 202603230001_originality_v1_foundation.sql");
    expect(bundle).toContain("create table profiles(id uuid primary key);");
    expect(bundle).toContain("create table originality_checks(id uuid primary key);");
  });
});
