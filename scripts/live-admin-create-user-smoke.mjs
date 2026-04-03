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

  return data.session;
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
  const smokeEmail = `smoke-admin-user-${Date.now()}@example.com`;
  const smokeIdentifier = `700${Date.now().toString().slice(-6)}`;
  const smokePassword = "SmokeUser@123";

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let createdUserId = null;

  try {
    const adminSession = await signIn(url, anonKey, adminEmail, adminPassword);

    const response = await fetch(`${url}/functions/v1/admin-create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${adminSession.access_token}`,
      },
      body: JSON.stringify({
        email: smokeEmail,
        password: smokePassword,
        role: "student",
        full_name: "مستخدم اختبار الإدارة",
        identifier: smokeIdentifier,
        department: "كلية الحاسوب",
        role_title: "طالب",
        level: "المستوى الرابع",
        semester: "الفصل الثاني 1447",
        force_password_change: true,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Failed to invoke admin-create-user: ${raw}`);
    }

    const payload = raw ? JSON.parse(raw) : null;
    const createdUser = payload?.user;
    if (!payload?.ok || !createdUser?.id) {
      throw new Error("admin-create-user returned an unexpected payload");
    }

    createdUserId = createdUser.id;

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id,email,academic_id,role,department,full_name,first_login,default_password_flag")
      .eq("id", createdUserId)
      .single();

    if (profileError || !profile) {
      throw new Error(`Created profile not found: ${profileError?.message ?? "Unknown error"}`);
    }

    console.log(JSON.stringify({
      ok: true,
      created_user: {
        id: profile.id,
        email: profile.email,
        academic_id: profile.academic_id,
        role: profile.role,
        department: profile.department,
        full_name: profile.full_name,
        first_login: profile.first_login,
        default_password_flag: profile.default_password_flag,
      },
      cleanup: "deleting temporary auth user",
    }, null, 2));
  } finally {
    if (createdUserId) {
      await serviceClient.from("teacher_departments").delete().eq("teacher_id", createdUserId);
      await serviceClient.from("teacher_subjects").delete().eq("teacher_id", createdUserId);
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
