import { describe, expect, it } from "vitest";

import {
  normalizePreflightMode,
  SUPPORTED_PREFLIGHT_MODES,
} from "../../scripts/lib/supabase-check-modes.mjs";

describe("supabase check modes", () => {
  it("defaults to full mode when no argument is provided", () => {
    expect(normalizePreflightMode(undefined)).toBe("full");
  });

  it("accepts every supported preflight mode", () => {
    for (const mode of SUPPORTED_PREFLIGHT_MODES) {
      expect(normalizePreflightMode(mode)).toBe(mode);
    }
  });

  it("rejects unsupported modes", () => {
    expect(normalizePreflightMode("unknown")).toBeNull();
    expect(normalizePreflightMode("serve-all")).toBeNull();
  });

  it("supports repo-only validation mode", () => {
    expect(normalizePreflightMode("repo")).toBe("repo");
    expect(SUPPORTED_PREFLIGHT_MODES).toContain("repo");
  });
});
