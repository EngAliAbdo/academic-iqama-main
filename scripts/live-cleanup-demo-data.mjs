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

function isSmokeAuthUser(email) {
  return /^smoke-.*@example\.com$/i.test(email);
}

function isManualDemoAuthUser(email) {
  return /^(sproject\d+|spro\d+ject\d+)@gmail\.com$/i.test(email);
}

function isSmokeAssignment(title) {
  return /^\[(SMOKE|DEBUG)\]/i.test(title);
}

function isSmokeSubjectCode(code) {
  return /^(SMK|SMU|SMD|SSE)-/i.test(code);
}

function isSmokeNotification(notificationId) {
  return /^smoke-notification-read-/i.test(notificationId);
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

async function main() {
  const rootDir = process.cwd();
  const rootEnv = loadEnv(path.join(rootDir, ".env.local"));
  const functionEnv = loadEnv(path.join(rootDir, "supabase", ".env.local"));

  const url = ensure(rootEnv.VITE_SUPABASE_URL, "VITE_SUPABASE_URL");
  const serviceRoleKey = ensure(functionEnv.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");
  const apply = process.argv.includes("--apply");
  const includeManualDemo = process.argv.includes("--include-manual-demo");

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const [{ data: authUsersData, error: authUsersError }, profilesResult, assignmentsResult, subjectsResult, notificationsResult] = await Promise.all([
    serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    serviceClient
      .from("profiles")
      .select("id,email,full_name,role,academic_id,employee_number"),
    serviceClient
      .from("assignments")
      .select("id,title,teacher_id,subject_id"),
    serviceClient
      .from("subjects")
      .select("id,code,name_ar"),
    serviceClient
      .from("notification_reads")
      .select("id,user_id,notification_id"),
  ]);

  if (authUsersError) throw authUsersError;
  if (profilesResult.error) throw profilesResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  if (subjectsResult.error) throw subjectsResult.error;
  if (notificationsResult.error) throw notificationsResult.error;

  const authUsers = authUsersData?.users ?? [];
  const profiles = profilesResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const subjects = subjectsResult.data ?? [];
  const notifications = notificationsResult.data ?? [];

  const authDeletionCandidates = authUsers
    .filter((user) => user.email)
    .filter((user) => isSmokeAuthUser(user.email) || (includeManualDemo && isManualDemoAuthUser(user.email)))
    .map((user) => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    }));

  const authCandidateIds = new Set(authDeletionCandidates.map((user) => user.id));

  const profileCandidates = profiles
    .filter((profile) => authCandidateIds.has(profile.id))
    .map((profile) => ({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      identifier: profile.employee_number || profile.academic_id,
    }));

  const assignmentCandidates = assignments
    .filter((assignment) => isSmokeAssignment(assignment.title))
    .map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      teacher_id: assignment.teacher_id,
      subject_id: assignment.subject_id,
    }));

  const assignmentCandidateIds = new Set(assignmentCandidates.map((assignment) => assignment.id));

  const subjectCandidates = subjects
    .filter((subject) => isSmokeSubjectCode(subject.code))
    .map((subject) => ({
      id: subject.id,
      code: subject.code,
      name_ar: subject.name_ar,
    }));

  const subjectCandidateIds = new Set(subjectCandidates.map((subject) => subject.id));

  const notificationCandidates = notifications
    .filter((entry) => isSmokeNotification(entry.notification_id))
    .map((entry) => ({
      id: entry.id,
      user_id: entry.user_id,
      notification_id: entry.notification_id,
    }));

  const summary = {
    apply,
    include_manual_demo: includeManualDemo,
    candidates: {
      auth_users: authDeletionCandidates.length,
      profiles: profileCandidates.length,
      assignments: assignmentCandidates.length,
      subjects: subjectCandidates.length,
      notification_reads: notificationCandidates.length,
    },
    notes: [
      "الحسابات القياسية مثل admin@university.edu و teacher@university.edu و student@university.edu لا تدخل ضمن هذا التنظيف.",
      includeManualDemo
        ? "تم تضمين حسابات الديمو اليدوية ذات الإيميلات الغريبة ضمن المرشحين."
        : "حسابات الديمو اليدوية ذات الإيميلات الغريبة غير مضمنة. استخدم --include-manual-demo إذا أردت معاينتها أو حذفها.",
    ],
    preview: {
      auth_users: authDeletionCandidates.slice(0, 10),
      profiles: profileCandidates.slice(0, 10),
      assignments: assignmentCandidates.slice(0, 10),
      subjects: subjectCandidates.slice(0, 10),
      notification_reads: notificationCandidates.slice(0, 10),
    },
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (notificationCandidates.length > 0) {
    const ids = notificationCandidates.map((entry) => entry.id);
    const { error } = await serviceClient.from("notification_reads").delete().in("id", ids);
    if (error) throw error;
  }

  if (assignmentCandidates.length > 0) {
    const { data: submissionRows, error: submissionQueryError } = await serviceClient
      .from("submissions")
      .select("id,file_path,assignment_id")
      .in("assignment_id", [...assignmentCandidateIds]);

    if (submissionQueryError) throw submissionQueryError;

    const filePaths = uniqueBy(
      (submissionRows ?? [])
        .filter((row) => row.file_path)
        .map((row) => ({ file_path: row.file_path })),
      "file_path",
    ).map((row) => row.file_path);

    if (filePaths.length > 0) {
      const { error: storageError } = await serviceClient.storage.from("student-submissions").remove(filePaths);
      if (storageError) {
        throw new Error(`Failed to remove storage files: ${storageError.message}`);
      }
    }

    const { error: deleteAssignmentsError } = await serviceClient
      .from("assignments")
      .delete()
      .in("id", [...assignmentCandidateIds]);

    if (deleteAssignmentsError) throw deleteAssignmentsError;
  }

  if (subjectCandidates.length > 0) {
    await Promise.all([
      serviceClient.from("teacher_subjects").delete().in("subject_id", [...subjectCandidateIds]),
      serviceClient.from("student_subjects").delete().in("subject_id", [...subjectCandidateIds]),
    ]);

    const { error: deleteSubjectsError } = await serviceClient
      .from("subjects")
      .delete()
      .in("id", [...subjectCandidateIds]);

    if (deleteSubjectsError) throw deleteSubjectsError;
  }

  for (const user of authDeletionCandidates) {
    const { error } = await serviceClient.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }

  console.log(JSON.stringify({
    ok: true,
    deleted: summary.candidates,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message,
  }, null, 2));
  process.exit(1);
});
