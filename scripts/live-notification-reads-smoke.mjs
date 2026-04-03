import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_SMOKE_STUDENT_EMAIL,
  DEFAULT_SMOKE_STUDENT_PASSWORD,
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

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const notificationId = `smoke-notification-read-${Date.now()}`;
  let studentId = null;

  try {
    await ensureLiveSmokeBaseline({
      url,
      serviceRoleKey,
      studentEmail,
      studentPassword,
    });

    const { client: studentClient, session } = await signIn(url, anonKey, studentEmail, studentPassword);
    studentId = session.user.id;

    const { data: upserted, error: upsertError } = await studentClient
      .from("notification_reads")
      .upsert({
        user_id: studentId,
        notification_id: notificationId,
        read_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,notification_id",
      })
      .select("id,user_id,notification_id,read_at")
      .single();

    if (upsertError || !upserted) {
      throw new Error(`Failed to write notification_reads row: ${upsertError?.message ?? "Unknown error"}`);
    }

    const { data: visibleRows, error: visibleError } = await studentClient
      .from("notification_reads")
      .select("notification_id")
      .eq("user_id", studentId)
      .eq("notification_id", notificationId);

    if (visibleError) {
      throw new Error(`Student could not read notification_reads row: ${visibleError.message}`);
    }

    if (!visibleRows || visibleRows.length !== 1) {
      throw new Error("notification_reads row was not visible to the student account");
    }

    console.log(JSON.stringify({
      ok: true,
      notification_read: {
        id: upserted.id,
        user_id: upserted.user_id,
        notification_id: upserted.notification_id,
      },
      cleanup: "deleting temporary notification read row",
    }, null, 2));
  } finally {
    if (studentId) {
      await serviceClient
        .from("notification_reads")
        .delete()
        .eq("user_id", studentId)
        .eq("notification_id", notificationId);
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
