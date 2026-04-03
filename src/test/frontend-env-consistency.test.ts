import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertFrontendEnvConsistency,
  getFrontendEnvConsistencyIssues,
} from "../../scripts/lib/frontend-env-consistency.mjs";

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "frontend-env-consistency-"));
}

function writeEnvFile(dirPath: string, fileName: string, content: string) {
  fs.writeFileSync(path.join(dirPath, fileName), content, "utf8");
}

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dirPath = tempDirs.pop();

    if (dirPath) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }
});

function createJwtWithRef(ref: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ ref, role: "anon" })).toString("base64url");
  return `${header}.${payload}.signature`;
}

describe("frontend env consistency", () => {
  it("ignores missing companion files", () => {
    const dirPath = createTempDir();
    tempDirs.push(dirPath);

    writeEnvFile(dirPath, ".env.local", "VITE_SUPABASE_PROJECT_ID=project-a");

    expect(getFrontendEnvConsistencyIssues(dirPath)).toEqual([]);
  });

  it("allows placeholder .env values when .env.local has real values", () => {
    const dirPath = createTempDir();
    tempDirs.push(dirPath);

    writeEnvFile(dirPath, ".env", `
      VITE_SUPABASE_PROJECT_ID=your-project-id
      VITE_SUPABASE_URL=https://your-project.supabase.co
      VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
    `);
    writeEnvFile(dirPath, ".env.local", `
      VITE_SUPABASE_PROJECT_ID=project-a
      VITE_SUPABASE_URL=https://project-a.supabase.co
      VITE_SUPABASE_PUBLISHABLE_KEY=${createJwtWithRef("project-a")}
    `);

    expect(getFrontendEnvConsistencyIssues(dirPath)).toEqual([]);
  });

  it("detects when .env and .env.local point to different Supabase projects", () => {
    const dirPath = createTempDir();
    tempDirs.push(dirPath);

    writeEnvFile(dirPath, ".env", `
      VITE_SUPABASE_PROJECT_ID=project-a
      VITE_SUPABASE_URL=https://project-a.supabase.co
      VITE_SUPABASE_PUBLISHABLE_KEY=${createJwtWithRef("project-a")}
    `);
    writeEnvFile(dirPath, ".env.local", `
      VITE_SUPABASE_PROJECT_ID=project-b
      VITE_SUPABASE_URL=https://project-b.supabase.co
      VITE_SUPABASE_PUBLISHABLE_KEY=${createJwtWithRef("project-b")}
    `);

    expect(getFrontendEnvConsistencyIssues(dirPath)).toEqual([
      "VITE_SUPABASE_PROJECT_ID differs between .env and .env.local",
      "VITE_SUPABASE_URL host differs between .env and .env.local",
      "VITE_SUPABASE_PUBLISHABLE_KEY ref differs between .env and .env.local",
    ]);
  });

  it("throws with actionable guidance when env files conflict", () => {
    const dirPath = createTempDir();
    tempDirs.push(dirPath);

    writeEnvFile(dirPath, ".env", "VITE_SUPABASE_PROJECT_ID=project-a");
    writeEnvFile(dirPath, ".env.local", "VITE_SUPABASE_PROJECT_ID=project-b");

    expect(() => assertFrontendEnvConsistency(dirPath)).toThrow(
      "Conflicting frontend Supabase env values detected between .env and .env.local.",
    );
  });
});
