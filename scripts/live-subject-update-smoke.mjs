import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let createdSubjectId = null;
  let createdAssignmentId = null;
  let createdMappingId = null;

  try {
    const { client: adminClient } = await signIn(url, anonKey, adminEmail, adminPassword);

    const { data: teacherProfile, error: teacherError } = await serviceClient
      .from("profiles")
      .select("id,full_name")
      .eq("role", "teacher")
      .limit(1)
      .single();

    if (teacherError || !teacherProfile) {
      throw new Error(`Teacher profile not found: ${teacherError?.message ?? "Unknown error"}`);
    }

    const stamp = Date.now().toString();
    const initialSubject = {
      name_ar: "مادة اختبار تحديث المواد",
      name_en: "Subject Update Smoke",
      code: `SMU-${stamp.slice(-6)}`,
      department: "كلية الحاسوب",
      level: "المستوى السادس",
      semester: "الفصل الثاني 1447",
      status: "active",
    };

    const { data: insertedSubject, error: insertSubjectError } = await adminClient
      .from("subjects")
      .insert(initialSubject)
      .select("id,name_ar,name_en,code,department,level,semester,status")
      .single();

    if (insertSubjectError || !insertedSubject) {
      throw new Error(`Failed to create smoke subject: ${insertSubjectError?.message ?? "Unknown error"}`);
    }

    createdSubjectId = insertedSubject.id;

    const { data: insertedMapping, error: insertMappingError } = await serviceClient
      .from("teacher_subjects")
      .insert({
        teacher_id: teacherProfile.id,
        subject_id: createdSubjectId,
        department: insertedSubject.department,
        level: insertedSubject.level,
        semester: insertedSubject.semester,
      })
      .select("id")
      .single();

    if (insertMappingError || !insertedMapping) {
      throw new Error(`Failed to create smoke teacher_subjects row: ${insertMappingError?.message ?? "Unknown error"}`);
    }

    createdMappingId = insertedMapping.id;

    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 5);
    dueAt.setHours(23, 59, 0, 0);

    const { data: insertedAssignment, error: insertAssignmentError } = await serviceClient
      .from("assignments")
      .insert({
        title: "تكليف اختبار تحديث المواد",
        subject: insertedSubject.name_ar,
        subject_id: createdSubjectId,
        teacher_id: teacherProfile.id,
        teacher_name: teacherProfile.full_name,
        level: insertedSubject.level,
        due_at: dueAt.toISOString(),
        due_time: "23:59:00",
        description: "اختبار حي لتحديث المادة داخل بوابة الإدارة.",
        instructions: "Smoke test only.",
        allowed_formats: ["PDF"],
        max_submissions: 1,
        attachments: [],
        has_attachment: false,
        resubmission_policy: "replace_latest",
        status: "draft",
      })
      .select("id,subject,level")
      .single();

    if (insertAssignmentError || !insertedAssignment) {
      throw new Error(`Failed to create smoke assignment: ${insertAssignmentError?.message ?? "Unknown error"}`);
    }

    createdAssignmentId = insertedAssignment.id;

    const updatedSubject = {
      name_ar: "مادة اختبار محدثة من الإدارة",
      name_en: "Updated Admin Subject Smoke",
      code: `${initialSubject.code}-UPD`,
      department: "عمادة التعلم الإلكتروني",
      level: "المستوى السابع",
      semester: "الفصل الأول 1448",
      status: "archived",
    };

    const { data: updatedRow, error: updateSubjectError } = await adminClient
      .from("subjects")
      .update(updatedSubject)
      .eq("id", createdSubjectId)
      .select("id,name_ar,name_en,code,department,level,semester,status")
      .single();

    if (updateSubjectError || !updatedRow) {
      throw new Error(`Failed to update smoke subject: ${updateSubjectError?.message ?? "Unknown error"}`);
    }

    const { error: syncAssignmentsError } = await adminClient
      .from("assignments")
      .update({
        subject: updatedRow.name_ar,
        level: updatedRow.level,
      })
      .eq("subject_id", createdSubjectId);

    if (syncAssignmentsError) {
      throw new Error(`Failed to sync related assignments: ${syncAssignmentsError.message}`);
    }

    const { error: syncTeacherSubjectsError } = await adminClient
      .from("teacher_subjects")
      .update({
        department: updatedRow.department,
        level: updatedRow.level,
        semester: updatedRow.semester,
      })
      .eq("subject_id", createdSubjectId);

    if (syncTeacherSubjectsError) {
      throw new Error(`Failed to sync teacher_subjects: ${syncTeacherSubjectsError.message}`);
    }

    const { data: verifiedAssignment, error: verifyAssignmentError } = await serviceClient
      .from("assignments")
      .select("id,subject,level")
      .eq("id", createdAssignmentId)
      .single();

    if (verifyAssignmentError || !verifiedAssignment) {
      throw new Error(`Updated assignment not found: ${verifyAssignmentError?.message ?? "Unknown error"}`);
    }

    const { data: verifiedMapping, error: verifyMappingError } = await serviceClient
      .from("teacher_subjects")
      .select("id,department,level,semester")
      .eq("id", createdMappingId)
      .single();

    if (verifyMappingError || !verifiedMapping) {
      throw new Error(`Updated teacher_subjects row not found: ${verifyMappingError?.message ?? "Unknown error"}`);
    }

    console.log(JSON.stringify({
      ok: true,
      subject: {
        id: updatedRow.id,
        code: updatedRow.code,
        name_ar: updatedRow.name_ar,
        status: updatedRow.status,
      },
      assignment_sync: verifiedAssignment,
      teacher_subject_sync: verifiedMapping,
      cleanup: "deleting temporary subject, assignment, and teacher mapping",
    }, null, 2));
  } finally {
    if (createdAssignmentId) {
      await serviceClient.from("assignments").delete().eq("id", createdAssignmentId);
    }

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
