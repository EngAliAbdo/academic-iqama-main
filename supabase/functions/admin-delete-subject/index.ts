import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type UserRole = "student" | "teacher" | "admin";

interface DeleteSubjectPayload {
  subject_id?: string;
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
  };
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

    const body = await request.json() as DeleteSubjectPayload;
    const subjectId = normalizeText(body.subject_id);

    if (!subjectId) {
      return jsonResponse({ error: "معرّف المادة المطلوب غير موجود." }, 400);
    }

    const { data: subject, error: subjectError } = await supabase
      .from("subjects")
      .select("id,name_ar,code")
      .eq("id", subjectId)
      .single();

    if (subjectError || !subject) {
      return jsonResponse({ error: "تعذر العثور على المادة المطلوبة." }, 404);
    }

    const [
      { data: linkedAssignment, error: assignmentError },
      { data: linkedTeacherMapping, error: teacherMappingError },
      { data: linkedStudentMapping, error: studentMappingError },
    ] = await Promise.all([
      supabase
        .from("assignments")
        .select("id")
        .eq("subject_id", subjectId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("teacher_subjects")
        .select("id")
        .eq("subject_id", subjectId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("student_subjects")
        .select("id")
        .eq("subject_id", subjectId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (assignmentError || teacherMappingError || studentMappingError) {
      return jsonResponse({ error: "تعذر التحقق من ارتباطات المادة الحالية قبل الحذف." }, 500);
    }

    if (linkedAssignment) {
      return jsonResponse({
        error: "لا يمكن حذف المادة لوجود تكليفات مرتبطة بها. قم بأرشفتها بدلًا من حذفها.",
      }, 400);
    }

    if (linkedTeacherMapping) {
      return jsonResponse({
        error: "لا يمكن حذف المادة لوجود معلمين مرتبطين بها. قم بفك الارتباطات أولًا.",
      }, 400);
    }

    if (linkedStudentMapping) {
      return jsonResponse({
        error: "لا يمكن حذف المادة لوجود طلاب مرتبطين بها. قم بفك ارتباطات الطلاب أولًا.",
      }, 400);
    }

    const { error: deleteError } = await supabase
      .from("subjects")
      .delete()
      .eq("id", subjectId);

    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 500);
    }

    return jsonResponse({
      ok: true,
      deleted_subject: {
        id: subject.id,
        name_ar: subject.name_ar,
        code: subject.code,
      },
    });
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});
