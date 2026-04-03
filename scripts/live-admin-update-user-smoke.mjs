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

  const smokeStamp = Date.now().toString();
  const smokeEmail = `smoke-update-user-${smokeStamp}@example.com`;
  const initialIdentifier = `701${smokeStamp.slice(-6)}`;
  const updatedIdentifier = `702${smokeStamp.slice(-6)}`;
  const initialPassword = "SmokeUser@123";
  const updatedPassword = "UpdatedSmoke@123";

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let createdUserId = null;

  try {
    const { session: adminSession } = await signIn(url, anonKey, adminEmail, adminPassword);

    const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser({
      email: smokeEmail,
      password: initialPassword,
      email_confirm: true,
      user_metadata: {
        academic_id: initialIdentifier,
        full_name: "مستخدم اختبار تعديل الإدارة",
        full_name_ar: "مستخدم اختبار تعديل الإدارة",
        full_name_en: "Admin Update Smoke User",
        role: "student",
        department: "كلية الحاسوب",
        role_title: "طالب",
        level: "المستوى الرابع",
        semester: "الفصل الثاني 1447",
        must_change_password: false,
        first_login: false,
        default_password_flag: false,
      },
    });

    if (createUserError || !createdUser.user) {
      throw new Error(`Failed to create smoke auth user: ${createUserError?.message ?? "Unknown error"}`);
    }

    createdUserId = createdUser.user.id;

    const { error: profileError } = await serviceClient
      .from("profiles")
      .update({
        academic_id: initialIdentifier,
        employee_number: null,
        full_name: "مستخدم اختبار تعديل الإدارة",
        full_name_ar: "مستخدم اختبار تعديل الإدارة",
        full_name_en: "Admin Update Smoke User",
        role: "student",
        department: "كلية الحاسوب",
        role_title: "طالب",
        level: "المستوى الرابع",
        semester: "الفصل الثاني 1447",
        must_change_password: false,
        first_login: false,
        default_password_flag: false,
      })
      .eq("id", createdUserId);

    if (profileError) {
      throw new Error(`Failed to prime smoke profile: ${profileError.message}`);
    }

    const response = await fetch(`${url}/functions/v1/admin-update-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${adminSession.access_token}`,
      },
      body: JSON.stringify({
        user_id: createdUserId,
        email: smokeEmail,
        password: updatedPassword,
        role: "teacher",
        full_name: "مستخدم معدل من الإدارة",
        full_name_ar: "مستخدم معدل من الإدارة",
        full_name_en: "Updated Admin Smoke User",
        identifier: updatedIdentifier,
        department: "عمادة التعلم الإلكتروني",
        role_title: "معلم متعاون",
        force_password_change: true,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Failed to invoke admin-update-user: ${raw}`);
    }

    const payload = raw ? JSON.parse(raw) : null;
    if (!payload?.ok || !payload.user?.id) {
      throw new Error("admin-update-user returned an unexpected payload");
    }

    const { data: profile, error: updatedProfileError } = await serviceClient
      .from("profiles")
      .select("id,email,academic_id,employee_number,full_name,role,department,role_title,must_change_password")
      .eq("id", createdUserId)
      .single();

    if (updatedProfileError || !profile) {
      throw new Error(`Updated profile not found: ${updatedProfileError?.message ?? "Unknown error"}`);
    }

    const { data: teacherDepartments, error: teacherDepartmentError } = await serviceClient
      .from("teacher_departments")
      .select("teacher_id,department")
      .eq("teacher_id", createdUserId);

    if (teacherDepartmentError) {
      throw new Error(`Teacher department check failed: ${teacherDepartmentError.message}`);
    }

    console.log(JSON.stringify({
      ok: true,
      updated_user: {
        id: profile.id,
        email: profile.email,
        academic_id: profile.academic_id,
        employee_number: profile.employee_number,
        full_name: profile.full_name,
        role: profile.role,
        department: profile.department,
        role_title: profile.role_title,
        must_change_password: profile.must_change_password,
      },
      teacher_departments: teacherDepartments ?? [],
      cleanup: "deleting temporary auth user",
    }, null, 2));
  } finally {
    if (createdUserId) {
      await serviceClient.from("teacher_subjects").delete().eq("teacher_id", createdUserId);
      await serviceClient.from("teacher_departments").delete().eq("teacher_id", createdUserId);
      await serviceClient.from("profiles").delete().eq("id", createdUserId);
      await serviceClient.auth.admin.deleteUser(createdUserId);
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
