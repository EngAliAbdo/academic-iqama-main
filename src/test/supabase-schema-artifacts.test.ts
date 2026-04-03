import { describe, expect, it } from "vitest";

import {
  analyzeSchemaArtifacts,
  getSchemaArtifactIssues,
} from "../../scripts/lib/supabase-schema-artifacts.mjs";

describe("supabase schema artifact helpers", () => {
  it("accepts migrations that define the required core artifacts", () => {
    const summary = analyzeSchemaArtifacts([
      `
      create table public.profiles ();
      create table public.assignments ();
      create table public.submissions ();
      create table public.subjects ();
      create table public.student_subjects ();
      create table public.reviews ();
      create table public.originality_checks ();
      create table public.submission_matches ();
      create table public.activity_logs ();
      create table if not exists public.system_settings ();
      insert into storage.buckets (id, name) values ('assignment-attachments', 'assignment-attachments');
      insert into storage.buckets (id, name) values ('student-submissions', 'student-submissions');
      create or replace function public.get_accessible_originality_checks() returns void as $$ select 1; $$ language sql;
      create or replace function public.get_accessible_reviews() returns void as $$ select 1; $$ language sql;
      `,
    ]);

    expect(summary).toEqual({
      missingTables: [],
      missingBuckets: [],
      missingRpcFunctions: [],
    });

    expect(getSchemaArtifactIssues(summary)).toEqual([]);
  });

  it("reports missing tables, buckets, and rpc functions clearly", () => {
    const summary = analyzeSchemaArtifacts([
      `
      create table public.profiles ();
      create table public.assignments ();
      create table public.submissions ();
      `,
    ]);

    expect(getSchemaArtifactIssues(summary)).toEqual([
      "missing tables: subjects, student_subjects, reviews, originality_checks, submission_matches, activity_logs, system_settings",
      "missing storage buckets: assignment-attachments, student-submissions",
      "missing rpc functions: get_accessible_originality_checks, get_accessible_reviews",
    ]);
  });
});
