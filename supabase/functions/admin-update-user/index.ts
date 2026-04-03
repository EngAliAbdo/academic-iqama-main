import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type UserRole = "student" | "teacher" | "admin";

interface UpdateUserPayload {
  user_id?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  full_name?: string;
  full_name_ar?: string;
  full_name_en?: string;
  identifier?: string;
  department?: string;
  role_title?: string;
  level?: string;
  semester?: string;
  force_password_change?: boolean;
}

interface AuthenticatedActor {
  id: string;
  role: UserRole;
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

function isUserRole(value: unknown): value is UserRole {
  return value === "student" || value === "teacher" || value === "admin";
}

function getDefaultRoleTitle(role: UserRole) {
  return {
    student: "طالب",
    teacher: "عضو هيئة التدريس",
    admin: "مسؤول النظام",
  }[role];
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

async function ensureIdentifierAvailable(userId: string, identifier: string, email: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,academic_id,employee_number")
    .neq("id", userId)
    .or(`email.ilike.${email},academic_id.eq.${identifier},employee_number.eq.${identifier}`)
    .limit(1);

  if (error) {
    throw error;
  }

  if ((data ?? []).length > 0) {
    throw new Error("يوجد مستخدم آخر بنفس البريد أو نفس المعرّف.");
  }
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

    const body = await request.json() as UpdateUserPayload;
    const userId = normalizeText(body.user_id);
    const role = isUserRole(body.role) ? body.role : null;
    const email = normalizeText(body.email).toLowerCase();
    const password = normalizeText(body.password);
    const fullName = normalizeText(body.full_name);
    const fullNameAr = normalizeText(body.full_name_ar) || fullName;
    const fullNameEn = normalizeText(body.full_name_en);
    const identifier = normalizeText(body.identifier);
    const department = normalizeText(body.department);
    const level = normalizeText(body.level);
    const semester = normalizeText(body.semester);
    const roleTitle = normalizeText(body.role_title) || (role ? getDefaultRoleTitle(role) : "");
    const forcePasswordChange = body.force_password_change === true;

    if (!userId) {
      return jsonResponse({ error: "معرّف المستخدم المطلوب غير موجود." }, 400);
    }

    if (!role) {
      return jsonResponse({ error: "الدور المطلوب غير صالح." }, 400);
    }

    if (!email || !email.includes("@")) {
      return jsonResponse({ error: "أدخل بريدًا إلكترونيًا صحيحًا." }, 400);
    }

    if (password && password.length < 6) {
      return jsonResponse({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." }, 400);
    }

    if (!fullName) {
      return jsonResponse({ error: "الاسم الكامل مطلوب." }, 400);
    }

    if (!identifier) {
      return jsonResponse({ error: "المعرّف الأكاديمي أو الوظيفي مطلوب." }, 400);
    }

    if (role !== "admin" && !department) {
      return jsonResponse({ error: "القسم أو الجهة مطلوبة." }, 400);
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("id,role,level,semester")
      .eq("id", userId)
      .single();

    if (existingProfileError || !existingProfile) {
      return jsonResponse({ error: "تعذر العثور على المستخدم المطلوب." }, 404);
    }

    if (existingProfile.role === "teacher" && role !== "teacher") {
      const [{ count: assignmentCount, error: assignmentCountError }, { count: mappingCount, error: mappingCountError }] =
        await Promise.all([
          supabase
            .from("assignments")
            .select("id", { count: "exact", head: true })
            .eq("teacher_id", userId),
          supabase
            .from("teacher_subjects")
            .select("id", { count: "exact", head: true })
            .eq("teacher_id", userId),
        ]);

      if (assignmentCountError || mappingCountError) {
        return jsonResponse({ error: "تعذر التحقق من ارتباطات المعلم الحالية." }, 500);
      }

      if ((assignmentCount ?? 0) > 0 || (mappingCount ?? 0) > 0) {
        return jsonResponse({
          error: "لا يمكن تغيير دور هذا المعلم حالياً لوجود تكليفات أو مواد مرتبطة به.",
        }, 400);
      }
    }

    await ensureIdentifierAvailable(userId, identifier, email);

    const normalizedDepartment = role === "admin" ? "" : department;
    const employeeNumber = role === "student" ? null : identifier;
    const nextLevel = level || existingProfile.level || "";
    const nextSemester = semester || existingProfile.semester || "";

    const { data: updatedUser, error: updatedUserError } = await supabase.auth.admin.updateUserById(userId, {
      email,
      ...(password ? { password } : {}),
      user_metadata: {
        academic_id: identifier,
        employee_number: employeeNumber,
        full_name: fullName,
        full_name_ar: fullNameAr,
        full_name_en: fullNameEn,
        role,
        department: normalizedDepartment,
        role_title: roleTitle,
        level: nextLevel,
        semester: nextSemester,
        must_change_password: forcePasswordChange,
        first_login: forcePasswordChange,
        default_password_flag: forcePasswordChange,
      },
    });

    if (updatedUserError || !updatedUser.user) {
      return jsonResponse({
        error: updatedUserError?.message ?? "تعذر تحديث المستخدم في نظام المصادقة.",
      }, 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .update({
        academic_id: identifier,
        full_name: fullName,
        full_name_ar: fullNameAr,
        full_name_en: fullNameEn,
        employee_number: employeeNumber,
        role,
        department: normalizedDepartment,
        role_title: roleTitle,
        level: nextLevel,
        semester: nextSemester,
        must_change_password: forcePasswordChange,
        first_login: forcePasswordChange,
        default_password_flag: forcePasswordChange,
      })
      .eq("id", userId)
      .select("id,email,academic_id,full_name,role,department,role_title,must_change_password")
      .single();

    if (profileError || !profile) {
      return jsonResponse({
        error: profileError?.message ?? "تعذر تحديث الملف الشخصي للمستخدم.",
      }, 500);
    }

    if (role === "teacher") {
      const { error: teacherDepartmentError } = await supabase
        .from("teacher_departments")
        .upsert({
          teacher_id: userId,
          department: normalizedDepartment,
        }, {
          onConflict: "teacher_id,department",
        });

      if (teacherDepartmentError) {
        return jsonResponse({
          error: teacherDepartmentError.message,
        }, 500);
      }
    } else {
      const { error: teacherDepartmentDeleteError } = await supabase
        .from("teacher_departments")
        .delete()
        .eq("teacher_id", userId);

      if (teacherDepartmentDeleteError) {
        return jsonResponse({
          error: teacherDepartmentDeleteError.message,
        }, 500);
      }
    }

    return jsonResponse({
      ok: true,
      user: {
        id: profile.id,
        email: profile.email,
        academicId: profile.academic_id,
        fullName: profile.full_name,
        role: profile.role,
        department: profile.department,
        roleTitle: profile.role_title,
        mustChangePassword: profile.must_change_password,
      },
    });
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});
