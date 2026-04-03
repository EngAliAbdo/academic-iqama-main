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

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let createdSubjectId = null;

  try {
    const { session: adminSession } = await signIn(url, anonKey, adminEmail, adminPassword);

    const { data: subject, error: createError } = await serviceClient
      .from("subjects")
      .insert({
        name_ar: "مادة اختبار حذف من الإدارة",
        name_en: "Admin Delete Subject Smoke",
        code: `SMD-${smokeStamp.slice(-6)}`,
        department: "كلية الحاسوب",
        level: "المستوى الخامس",
        semester: "الفصل الثاني 1447",
        status: "active",
      })
      .select("id,name_ar,code")
      .single();

    if (createError || !subject) {
      throw new Error(`Failed to create smoke subject: ${createError?.message ?? "Unknown error"}`);
    }

    createdSubjectId = subject.id;

    const response = await fetch(`${url}/functions/v1/admin-delete-subject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${adminSession.access_token}`,
      },
      body: JSON.stringify({
        subject_id: createdSubjectId,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Failed to invoke admin-delete-subject: ${raw}`);
    }

    const payload = raw ? JSON.parse(raw) : null;
    if (!payload?.ok || !payload.deleted_subject?.id) {
      throw new Error("admin-delete-subject returned an unexpected payload");
    }

    const { data: deletedSubject, error: deletedSubjectError } = await serviceClient
      .from("subjects")
      .select("id")
      .eq("id", createdSubjectId)
      .maybeSingle();

    if (deletedSubjectError) {
      throw new Error(`Failed to verify deleted subject: ${deletedSubjectError.message}`);
    }

    if (deletedSubject) {
      throw new Error("Smoke subject still exists after admin-delete-subject");
    }

    createdSubjectId = null;

    console.log(JSON.stringify({
      ok: true,
      deleted_subject: payload.deleted_subject,
      cleanup: "completed by function",
    }, null, 2));
  } finally {
    if (createdSubjectId) {
      await serviceClient.from("teacher_subjects").delete().eq("subject_id", createdSubjectId);
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
