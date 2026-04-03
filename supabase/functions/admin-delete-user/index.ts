import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type UserRole = "student" | "teacher" | "admin";

interface DeleteUserPayload {
  user_id?: string;
}

interface AuthenticatedActor {
  id: string;
  role: UserRole;
}

interface DeleteImpactSummary {
  assignments: number;
  submissions: number;
  reviews: number;
  teacher_subjects: number;
  teacher_departments: number;
  student_subjects: number;
  notification_reads: number;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const authSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function authenticateActor(request: Request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return null;
  }

  const { data: authData, error: authError } = await authSupabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single<{ role: UserRole }>();

  if (profileError || !profile) {
    return null;
  }

  return {
    id: authData.user.id,
    role: profile.role,
  } satisfies AuthenticatedActor;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing Supabase configuration" }, 500);
  }

  try {
    const actor = await authenticateActor(request);
    if (!actor) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    if (actor.role !== "admin") {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await request.json() as DeleteUserPayload;
    const userId = normalizeText(body.user_id);

    if (!userId) {
      return jsonResponse({ error: "معرف المستخدم المطلوب غير موجود." }, 400);
    }

    if (userId === actor.id) {
      return jsonResponse({ error: "لا يمكن للمسؤول حذف حسابه الحالي." }, 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,full_name,role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ error: "تعذر العثور على المستخدم المطلوب." }, 404);
    }

    if (profile.role === "admin") {
      const { count: adminCount, error: adminCountError } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if (adminCountError) {
        return jsonResponse({ error: "تعذر التحقق من عدد المسؤولين الحاليين." }, 500);
      }

      if ((adminCount ?? 0) <= 1) {
        return jsonResponse({ error: "لا يمكن حذف آخر مسؤول في النظام." }, 400);
      }
    }

    const [
      assignmentsResult,
      submissionsResult,
      reviewsResult,
      teacherSubjectsResult,
      teacherDepartmentsResult,
      studentSubjectsResult,
      notificationReadsResult,
    ] = await Promise.all([
      supabase.from("assignments").select("id", { count: "exact", head: true }).eq("teacher_id", userId),
      supabase.from("submissions").select("id", { count: "exact", head: true }).eq("student_id", userId),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("teacher_id", userId),
      supabase.from("teacher_subjects").select("id", { count: "exact", head: true }).eq("teacher_id", userId),
      supabase.from("teacher_departments").select("id", { count: "exact", head: true }).eq("teacher_id", userId),
      supabase.from("student_subjects").select("id", { count: "exact", head: true }).eq("student_id", userId),
      supabase.from("notification_reads").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);

    if (
      assignmentsResult.error
      || submissionsResult.error
      || reviewsResult.error
      || teacherSubjectsResult.error
      || teacherDepartmentsResult.error
      || studentSubjectsResult.error
      || notificationReadsResult.error
    ) {
      return jsonResponse({ error: "تعذر التحقق من الارتباطات الحالية للمستخدم." }, 500);
    }

    const impactSummary: DeleteImpactSummary = {
      assignments: assignmentsResult.count ?? 0,
      submissions: submissionsResult.count ?? 0,
      reviews: reviewsResult.count ?? 0,
      teacher_subjects: teacherSubjectsResult.count ?? 0,
      teacher_departments: teacherDepartmentsResult.count ?? 0,
      student_subjects: studentSubjectsResult.count ?? 0,
      notification_reads: notificationReadsResult.count ?? 0,
    };

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      return jsonResponse({
        error: deleteUserError.message || "تعذر حذف المستخدم من نظام المصادقة.",
      }, 400);
    }

    return jsonResponse({
      ok: true,
      deleted_user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
      },
      impact_summary: impactSummary,
    });
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});
