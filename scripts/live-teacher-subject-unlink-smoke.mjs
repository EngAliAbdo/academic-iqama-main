import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_SMOKE_TEACHER_EMAIL,
  DEFAULT_SMOKE_TEACHER_PASSWORD,
  ensureLiveSmokeBaseline,
} from "./lib/live-smoke-baseline.mjs";

function loadEnv(filePath) {
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => !line.trim().startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function ensure(value, label) {
  if (!value) {
    throw new Error(`Missing required value: ${label}`);
  }

  return value;
}

async function signIn(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session?.user) {
    throw new Error(`Failed to sign in ${email}: ${error?.message ?? "Unknown error"}`);
  }

  return {
    client,
    session: data.session,
  };
}

async function main() {
  const rootDir = process.cwd();
  const rootEnv = loadEnv(path.join(rootDir, ".env.local"));
  const functionEnv = loadEnv(path.join(rootDir, "supabase", ".env.local"));

  const url = ensure(rootEnv.VITE_SUPABASE_URL, "VITE_SUPABASE_URL");
  const anonKey = ensure(rootEnv.VITE_SUPABASE_PUBLISHABLE_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = ensure(functionEnv.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");

  const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "admin@university.edu";
  const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "Admin@123";
  const teacherEmail = process.env.SMOKE_TEACHER_EMAIL ?? DEFAULT_SMOKE_TEACHER_EMAIL;
  const teacherPassword = process.env.SMOKE_TEACHER_PASSWORD ?? DEFAULT_SMOKE_TEACHER_PASSWORD;

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let createdSubjectId = null;
  let createdMappingId = null;
  let teacherId = null;

  try {
    await ensureLiveSmokeBaseline({
      url,
      serviceRoleKey,
      teacherEmail,
      teacherPassword,
    });

    const { client: adminClient } = await signIn(url, anonKey, adminEmail, adminPassword);
    const { client: teacherClient, session: teacherSession } = await signIn(url, anonKey, teacherEmail, teacherPassword);

    teacherId = teacherSession.user.id;

    const stamp = Date.now().toString();
    const { data: subjectRow, error: subjectError } = await adminClient
      .from("subjects")
      .insert({
        name_ar: "Smoke Teacher Unlink Subject",
        name_en: "Teacher Subject Unlink Smoke",
        code: `UNL-${stamp.slice(-6)}`,
        department: "Computer College",
        level: "Level 5",
        semester: "Second Semester 1447",
        status: "active",
      })
      .select("id,department,level,semester")
      .single();

    if (subjectError || !subjectRow) {
      throw new Error(`Failed to create smoke subject: ${subjectError?.message ?? "Unknown error"}`);
    }

    createdSubjectId = subjectRow.id;

    const { data: mappingRow, error: mappingError } = await adminClient
      .from("teacher_subjects")
      .insert({
        teacher_id: teacherId,
        subject_id: createdSubjectId,
        department: subjectRow.department,
        level: subjectRow.level,
        semester: subjectRow.semester,
      })
      .select("id")
      .single();

    if (mappingError || !mappingRow) {
      throw new Error(`Failed to create smoke mapping: ${mappingError?.message ?? "Unknown error"}`);
    }

    createdMappingId = mappingRow.id;

    const { data: visibleBeforeDelete, error: visibleBeforeDeleteError } = await teacherClient
      .from("teacher_subjects")
      .select("id")
      .eq("id", createdMappingId);

    if (visibleBeforeDeleteError || !visibleBeforeDelete || visibleBeforeDelete.length !== 1) {
      throw new Error(`Teacher could not read smoke mapping before delete: ${visibleBeforeDeleteError?.message ?? "Unknown error"}`);
    }

    const { error: deleteError } = await adminClient
      .from("teacher_subjects")
      .delete()
      .eq("id", createdMappingId);

    if (deleteError) {
      throw new Error(`Failed to delete smoke mapping: ${deleteError.message}`);
    }

    createdMappingId = null;

    const { data: visibleAfterDelete, error: visibleAfterDeleteError } = await teacherClient
      .from("teacher_subjects")
      .select("id")
      .eq("subject_id", createdSubjectId)
      .eq("teacher_id", teacherId);

    if (visibleAfterDeleteError) {
      throw new Error(`Teacher visibility check after delete failed: ${visibleAfterDeleteError.message}`);
    }

    if (visibleAfterDelete && visibleAfterDelete.length > 0) {
      throw new Error("Teacher mapping was still visible after unlink");
    }

    console.log(JSON.stringify({
      ok: true,
      teacher_can_no_longer_read_mapping: true,
      cleanup: "deleting temporary subject",
    }, null, 2));
  } finally {
    if (createdMappingId) {
      await serviceClient.from("teacher_subjects").delete().eq("id", createdMappingId);
    }

    if (createdSubjectId) {
      await serviceClient.from("subjects").delete().eq("id", createdSubjectId);
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : "Unknown error",
  }, null, 2));
  process.exit(1);
});
