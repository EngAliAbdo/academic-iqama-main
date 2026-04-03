import { describe, expect, it } from "vitest";

import {
  analyzeEnvValues,
  extractProjectIdFromJwt,
  extractProjectIdFromUrl,
  getProjectConsistencyMismatches,
  parseEnvContent,
} from "../../scripts/lib/supabase-preflight.mjs";

function createJwtWithRef(ref: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ ref, role: "anon" })).toString("base64url");
  return `${header}.${payload}.signature`;
}

describe("supabase preflight helpers", () => {
  it("parses env content and strips quotes", () => {
    const parsed = parseEnvContent(`
      # comment
      VITE_SUPABASE_PROJECT_ID="project-ref"
      VITE_SUPABASE_URL='https://project-ref.supabase.co'
      EMPTY=
    `);

    expect(parsed).toEqual({
      VITE_SUPABASE_PROJECT_ID: "project-ref",
      VITE_SUPABASE_URL: "https://project-ref.supabase.co",
      EMPTY: "",
    });
  });

  it("detects missing and placeholder env values", () => {
    expect(
      analyzeEnvValues(
        {
          VITE_SUPABASE_PROJECT_ID: "your-project-id",
          VITE_SUPABASE_URL: "https://project.supabase.co",
        },
        [
          "VITE_SUPABASE_PROJECT_ID",
          "VITE_SUPABASE_PUBLISHABLE_KEY",
          "VITE_SUPABASE_URL",
        ],
      ),
    ).toEqual({
      missingKeys: ["VITE_SUPABASE_PUBLISHABLE_KEY"],
      placeholderKeys: ["VITE_SUPABASE_PROJECT_ID"],
    });
  });

  it("extracts the project ref from URL and JWT values", () => {
    expect(extractProjectIdFromUrl("https://lmqkgbatsfjfsfmmrykb.supabase.co")).toBe("lmqkgbatsfjfsfmmrykb");
    expect(extractProjectIdFromUrl("not-a-url")).toBeNull();
    expect(extractProjectIdFromJwt(createJwtWithRef("lmqkgbatsfjfsfmmrykb"))).toBe("lmqkgbatsfjfsfmmrykb");
    expect(extractProjectIdFromJwt("invalid.jwt")).toBeNull();
  });

  it("reports mismatches only when refs point to different projects", () => {
    expect(
      getProjectConsistencyMismatches({
        configProjectId: "lmqkgbatsfjfsfmmrykb",
        frontendProjectId: "lmqkgbatsfjfsfmmrykb",
        frontendUrl: "https://lmqkgbatsfjfsfmmrykb.supabase.co",
        publishableKey: createJwtWithRef("lmqkgbatsfjfsfmmrykb"),
        functionUrl: "https://lmqkgbatsfjfsfmmrykb.supabase.co",
      }),
    ).toEqual([]);

    expect(
      getProjectConsistencyMismatches({
        configProjectId: "project-a",
        frontendProjectId: "project-b",
        frontendUrl: "https://project-c.supabase.co",
        publishableKey: createJwtWithRef("project-d"),
        functionUrl: "https://project-e.supabase.co",
      }),
    ).toEqual([
      "config.toml project_id does not match VITE_SUPABASE_PROJECT_ID",
      "config.toml project_id does not match VITE_SUPABASE_URL host",
      "config.toml project_id does not match VITE_SUPABASE_PUBLISHABLE_KEY ref",
      "config.toml project_id does not match function SUPABASE_URL host",
    ]);
  });
});
