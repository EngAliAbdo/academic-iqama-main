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

  const smokeStamp = Date.now().toString();
  const smokeEmail = `smoke-delete-user-${smokeStamp}@example.com`;
  const smokeIdentifier = `709${smokeStamp.slice(-6)}`;
  const smokePassword = "DeleteSmoke@123";

  let createdUserId = null;

  try {
    const { session: adminSession } = await signIn(url, anonKey, adminEmail, adminPassword);

    const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser({
      email: smokeEmail,
      password: smokePassword,
      email_confirm: true,
      user_metadata: {
        academic_id: smokeIdentifier,
        full_name: "مستخدم اختبار حذف من الإدارة",
        full_name_ar: "مستخدم اختبار حذف من الإدارة",
        full_name_en: "Admin Delete Smoke User",
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
        academic_id: smokeIdentifier,
        employee_number: null,
        full_name: "مستخدم اختبار حذف من الإدارة",
        full_name_ar: "مستخدم اختبار حذف من الإدارة",
        full_name_en: "Admin Delete Smoke User",
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

    const response = await fetch(`${url}/functions/v1/admin-delete-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${adminSession.access_token}`,
      },
      body: JSON.stringify({
        user_id: createdUserId,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Failed to invoke admin-delete-user: ${raw}`);
    }

    const payload = raw ? JSON.parse(raw) : null;
    if (!payload?.ok || !payload.deleted_user?.id) {
      throw new Error("admin-delete-user returned an unexpected payload");
    }

    createdUserId = null;

    const { data: deletedProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("id", payload.deleted_user.id)
      .maybeSingle();

    const { data: deletedAuthUser } = await serviceClient.auth.admin.getUserById(payload.deleted_user.id);

    if (deletedProfile) {
      throw new Error("Deleted profile row still exists");
    }

    if (deletedAuthUser.user) {
      throw new Error("Deleted auth user still exists");
    }

    console.log(JSON.stringify({
      ok: true,
      deleted_user: payload.deleted_user,
      cleanup: "completed by function",
    }, null, 2));
  } finally {
    if (createdUserId) {
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
