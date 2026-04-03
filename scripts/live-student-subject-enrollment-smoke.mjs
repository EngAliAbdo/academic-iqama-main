import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_SMOKE_STUDENT_EMAIL,
  DEFAULT_SMOKE_STUDENT_PASSWORD,
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

  const studentEmail = process.env.SMOKE_STUDENT_EMAIL ?? DEFAULT_SMOKE_STUDENT_EMAIL;
  const studentPassword = process.env.SMOKE_STUDENT_PASSWORD ?? DEFAULT_SMOKE_STUDENT_PASSWORD;
  const teacherEmail = process.env.SMOKE_TEACHER_EMAIL ?? DEFAULT_SMOKE_TEACHER_EMAIL;
  const teacherPassword = process.env.SMOKE_TEACHER_PASSWORD ?? DEFAULT_SMOKE_TEACHER_PASSWORD;

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let subjectId = null;
  let assignmentId = null;
  let studentSubjectMappingId = null;

  try {
    await ensureLiveSmokeBaseline({
      url,
      serviceRoleKey,
      teacherEmail,
      teacherPassword,
      studentEmail,
      studentPassword,
    });

    const { client: studentClient, session: studentSession } = await signIn(
      url,
      anonKey,
      studentEmail,
      studentPassword,
    );

    const studentId = studentSession.user.id;

    const { data: studentProfile, error: studentProfileError } = await serviceClient
      .from("profiles")
      .select("id,department,level,semester")
      .eq("id", studentId)
      .single();

    if (studentProfileError || !studentProfile) {
      throw new Error(`Failed to load student profile: ${studentProfileError?.message ?? "Unknown error"}`);
    }

    const { data: teacherProfile, error: teacherProfileError } = await serviceClient
      .from("profiles")
      .select("id,full_name")
      .eq("email", teacherEmail)
      .maybeSingle();

    if (teacherProfileError || !teacherProfile) {
      throw new Error(`Failed to load teacher profile: ${teacherProfileError?.message ?? "Unknown error"}`);
    }

    const stamp = Date.now().toString();
    const smokeDepartment = `${studentProfile.department || "Student Department"} - Smoke Access`;

    const { data: subjectRow, error: subjectError } = await serviceClient
      .from("subjects")
      .insert({
        name_ar: "Smoke Student Enrollment Subject",
        name_en: "Student Subject Enrollment Smoke",
        code: `SSE-${stamp.slice(-6)}`,
        department: smokeDepartment,
        level: studentProfile.level || "Level 6",
        semester: studentProfile.semester || "Second Semester 1447",
        status: "active",
      })
      .select("id,name_ar,department,level,semester")
      .single();

    if (subjectError || !subjectRow) {
      throw new Error(`Failed to create smoke subject: ${subjectError?.message ?? "Unknown error"}`);
    }

    subjectId = subjectRow.id;

    const { data: assignmentRow, error: assignmentError } = await serviceClient
      .from("assignments")
      .insert({
        title: "Smoke Student Enrollment Assignment",
        subject: subjectRow.name_ar,
        subject_id: subjectId,
        teacher_id: teacherProfile.id,
        teacher_name: teacherProfile.full_name,
        level: studentProfile.level || subjectRow.level,
        due_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
        description: "Live smoke check for assignment visibility through student subject enrollment.",
        instructions: "Temporary smoke submission only.",
        allowed_formats: ["PDF"],
        max_submissions: 1,
        attachments: [],
        has_attachment: false,
        resubmission_policy: "replace_latest",
        status: "published",
      })
      .select("id")
      .single();

    if (assignmentError || !assignmentRow) {
      throw new Error(`Failed to create smoke assignment: ${assignmentError?.message ?? "Unknown error"}`);
    }

    assignmentId = assignmentRow.id;

    const { data: invisibleAssignments, error: invisibleError } = await studentClient
      .from("assignments")
      .select("id")
      .eq("id", assignmentId);

    if (invisibleError) {
      throw new Error(`Student pre-enrollment access check failed: ${invisibleError.message}`);
    }

    if (invisibleAssignments && invisibleAssignments.length > 0) {
      throw new Error("Student could access the assignment before subject enrollment");
    }

    const { data: mappingRow, error: mappingError } = await serviceClient
      .from("student_subjects")
      .insert({
        student_id: studentId,
        subject_id: subjectId,
      })
      .select("id")
      .single();

    if (mappingError || !mappingRow) {
      throw new Error(`Failed to create student_subjects mapping: ${mappingError?.message ?? "Unknown error"}`);
    }

    studentSubjectMappingId = mappingRow.id;

    const { data: visibleAssignments, error: visibleError } = await studentClient
      .from("assignments")
      .select("id")
      .eq("id", assignmentId);

    if (visibleError) {
      throw new Error(`Student post-enrollment access check failed: ${visibleError.message}`);
    }

    if (!visibleAssignments || visibleAssignments.length !== 1) {
      throw new Error("Student could not access the assignment after subject enrollment");
    }

    const { error: unlinkError } = await serviceClient
      .from("student_subjects")
      .delete()
      .eq("id", studentSubjectMappingId);

    if (unlinkError) {
      throw new Error(`Failed to remove student_subjects mapping: ${unlinkError.message}`);
    }

    studentSubjectMappingId = null;

    const { data: invisibleAgainAssignments, error: invisibleAgainError } = await studentClient
      .from("assignments")
      .select("id")
      .eq("id", assignmentId);

    if (invisibleAgainError) {
      throw new Error(`Student post-unlink access check failed: ${invisibleAgainError.message}`);
    }

    if (invisibleAgainAssignments && invisibleAgainAssignments.length > 0) {
      throw new Error("Student could still access the assignment after enrollment removal");
    }

    console.log(JSON.stringify({
      ok: true,
      student_access_before_enrollment: false,
      student_access_after_enrollment: true,
      student_access_after_unlink: false,
      cleanup: "deleting temporary assignment and subject",
    }, null, 2));
  } finally {
    if (studentSubjectMappingId) {
      await serviceClient.from("student_subjects").delete().eq("id", studentSubjectMappingId);
    }

    if (assignmentId) {
      await serviceClient.from("assignments").delete().eq("id", assignmentId);
    }

    if (subjectId) {
      await serviceClient.from("subjects").delete().eq("id", subjectId);
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
