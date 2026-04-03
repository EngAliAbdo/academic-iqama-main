import { describe, expect, it } from "vitest";

import {
  buildEnvInitPlan,
  ENV_FILE_MAPPINGS,
  FUNCTION_ENV_CANDIDATES,
  selectFunctionEnvFile,
} from "../../scripts/lib/supabase-env-files.mjs";

describe("supabase env file helpers", () => {
  it("builds a creation plan from the first available example files", () => {
    const existingPaths = new Set([
      ".env.local.example",
      "supabase/.env.example",
    ]);

    const plan = buildEnvInitPlan(
      ENV_FILE_MAPPINGS,
      (relativePath) => existingPaths.has(relativePath),
    );

    expect(plan).toEqual([
      {
        label: "Frontend env",
        target: ".env.local",
        sources: [".env.local.example", ".env.example"],
        status: "create",
        source: ".env.local.example",
        detail: ".env.local.example -> .env.local",
      },
      {
        label: "Function env",
        target: "supabase/.env.local",
        sources: ["supabase/.env.local.example", "supabase/.env.example"],
        status: "create",
        source: "supabase/.env.example",
        detail: "supabase/.env.example -> supabase/.env.local",
      },
    ]);
  });

  it("marks existing targets as skip and missing examples as failures", () => {
    const existingPaths = new Set([".env.local"]);

    const plan = buildEnvInitPlan(
      ENV_FILE_MAPPINGS,
      (relativePath) => existingPaths.has(relativePath),
    );

    expect(plan[0]).toMatchObject({
      label: "Frontend env",
      status: "skip",
      source: null,
      detail: ".env.local already exists.",
    });

    expect(plan[1]).toMatchObject({
      label: "Function env",
      status: "missing_source",
      source: null,
      detail: "No example file found for supabase/.env.local.",
    });
  });

  it("selects the first available function env file", () => {
    expect(
      selectFunctionEnvFile(
        FUNCTION_ENV_CANDIDATES,
        (relativePath) => relativePath === "supabase/.env",
      ),
    ).toBe("supabase/.env");

    expect(
      selectFunctionEnvFile(
        FUNCTION_ENV_CANDIDATES,
        () => false,
      ),
    ).toBeNull();
  });
});
