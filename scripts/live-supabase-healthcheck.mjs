import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();

const checks = [
  {
    id: "analysis-pdf",
    label: "PDF originality analysis",
    script: path.join(rootDir, "scripts", "live-supabase-e2e-smoke.mjs"),
    args: ["--format=pdf", "--cleanup"],
  },
  {
    id: "analysis-docx",
    label: "DOCX originality analysis",
    script: path.join(rootDir, "scripts", "live-supabase-e2e-smoke.mjs"),
    args: ["--format=docx", "--cleanup"],
  },
  {
    id: "admin-create-user",
    label: "Admin create user",
    script: path.join(rootDir, "scripts", "live-admin-create-user-smoke.mjs"),
    args: [],
  },
  {
    id: "admin-update-user",
    label: "Admin update user",
    script: path.join(rootDir, "scripts", "live-admin-update-user-smoke.mjs"),
    args: [],
  },
  {
    id: "admin-demote-user",
    label: "Admin demote teacher to student",
    script: path.join(rootDir, "scripts", "live-admin-demote-user-smoke.mjs"),
    args: [],
  },
  {
    id: "admin-delete-user",
    label: "Admin delete user",
    script: path.join(rootDir, "scripts", "live-admin-delete-user-smoke.mjs"),
    args: [],
  },
  {
    id: "teacher-subject-link",
    label: "Teacher subject link",
    script: path.join(rootDir, "scripts", "live-teacher-subject-link-smoke.mjs"),
    args: [],
  },
  {
    id: "teacher-subject-unlink",
    label: "Teacher subject unlink",
    script: path.join(rootDir, "scripts", "live-teacher-subject-unlink-smoke.mjs"),
    args: [],
  },
  {
    id: "student-subject-access",
    label: "Student subject access",
    script: path.join(rootDir, "scripts", "live-student-subject-enrollment-smoke.mjs"),
    args: [],
  },
  {
    id: "subject-delete",
    label: "Subject delete",
    script: path.join(rootDir, "scripts", "live-subject-delete-smoke.mjs"),
    args: [],
  },
  {
    id: "subject-update",
    label: "Subject update and archive",
    script: path.join(rootDir, "scripts", "live-subject-update-smoke.mjs"),
    args: [],
  },
  {
    id: "notification-reads",
    label: "Notification reads persistence",
    script: path.join(rootDir, "scripts", "live-notification-reads-smoke.mjs"),
    args: [],
  },
];

function runCheck(check) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [check.script, ...check.args], {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
    });

    child.on("close", (code, signal) => {
      resolve({
        id: check.id,
        label: check.label,
        ok: code === 0,
        exitCode: code ?? null,
        signal: signal ?? null,
        durationMs: Date.now() - startedAt,
      });
    });

    child.on("error", (error) => {
      resolve({
        id: check.id,
        label: check.label,
        ok: false,
        exitCode: null,
        signal: null,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Unknown spawn error",
      });
    });
  });
}

async function main() {
  const results = [];

  for (const check of checks) {
    console.log(`\n=== Running ${check.label} (${check.id}) ===`);
    const result = await runCheck(check);
    results.push(result);

    console.log(JSON.stringify({
      check: result.label,
      ok: result.ok,
      duration_ms: result.durationMs,
      exit_code: result.exitCode,
      signal: result.signal,
      error: result.error ?? null,
    }, null, 2));
  }

  const summary = {
    ok: results.every((result) => result.ok),
    total: results.length,
    passed: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  };

  console.log("\n=== Supabase live healthcheck summary ===");
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : "Unknown error",
  }, null, 2));
  process.exit(1);
});
