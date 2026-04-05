import { supabase } from "@/integrations/supabase/client";
import type { AuthUser, UserRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase-app";

const ADMIN_FUNCTION_TIMEOUT_MS = 15_000;

export interface CreateAdminUserInput {
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
  fullNameAr?: string;
  fullNameEn?: string;
  identifier: string;
  department: string;
  roleTitle: string;
  level?: string;
  semester?: string;
  forcePasswordChange?: boolean;
}

interface CreateAdminUserResult {
  ok: boolean;
  user?: AuthUser;
  error?: string;
}

export interface UpdateAdminUserInput {
  userId: string;
  email: string;
  password?: string;
  role: UserRole;
  fullName: string;
  fullNameAr?: string;
  fullNameEn?: string;
  identifier: string;
  department: string;
  roleTitle: string;
  level?: string;
  semester?: string;
  forcePasswordChange?: boolean;
}

interface UpdateAdminUserResult {
  ok: boolean;
  user?: AuthUser;
  error?: string;
}

export interface DeleteAdminUserInput {
  userId: string;
}

interface DeleteAdminUserResult {
  ok: boolean;
  deletedUser?: AuthUser;
  impactSummary?: {
    assignments: number;
    submissions: number;
    reviews: number;
    teacher_subjects: number;
    teacher_departments: number;
    student_subjects: number;
    notification_reads: number;
  };
  error?: string;
}

function getAdminFunctionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "انتهت مهلة الاتصال أثناء التواصل مع الخادم. حاول مرة أخرى.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

async function parseInvokeError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: { text?: () => Promise<string> } }).context;

    if (context?.text) {
      try {
        const raw = await context.text();
        if (raw.trim()) {
          const parsed = JSON.parse(raw) as { error?: string; message?: string };
          if (typeof parsed.error === "string" && parsed.error.trim()) {
            return parsed.error;
          }
          if (typeof parsed.message === "string" && parsed.message.trim()) {
            return parsed.message;
          }
          return raw;
        }
      } catch {
        // Ignore malformed function payloads and fall through to the generic message.
      }
    }
  }

  return getAdminFunctionErrorMessage(error, fallback);
}

async function invokeAdminFunction<T>(
  functionName: string,
  payload: Record<string, unknown>,
  fallbackError: string,
) {
  try {
    const invokePromise = supabase.functions.invoke<T>(functionName, {
      body: payload,
    });

    const result = await Promise.race([
      invokePromise,
      new Promise<never>((_, reject) => {
        window.setTimeout(
          () => reject(new DOMException("Timed out", "AbortError")),
          ADMIN_FUNCTION_TIMEOUT_MS,
        );
      }),
    ]);

    if (result.error) {
      return {
        ok: false as const,
        error: await parseInvokeError(result.error, fallbackError),
      };
    }

    return {
      ok: true as const,
      data: result.data,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: await parseInvokeError(error, fallbackError),
    };
  }
}

export async function createSupabaseAdminUser(input: CreateAdminUserInput): Promise<CreateAdminUserResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase غير مهيأ." };
  }

  const result = await invokeAdminFunction<{ user?: AuthUser }>(
    "admin-create-user",
    {
      email: input.email.trim(),
      password: input.password,
      role: input.role,
      full_name: input.fullName.trim(),
      full_name_ar: input.fullNameAr?.trim() || input.fullName.trim(),
      full_name_en: input.fullNameEn?.trim() || "",
      identifier: input.identifier.trim(),
      department: input.department.trim(),
      role_title: input.roleTitle.trim(),
      level: input.level?.trim() || "",
      semester: input.semester?.trim() || "",
      force_password_change: input.forcePasswordChange !== false,
    },
    "تعذر إنشاء المستخدم.",
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  if (!result.data?.user) {
    return { ok: false, error: "تم استلام استجابة غير مكتملة من الخادم." };
  }

  return {
    ok: true,
    user: result.data.user,
  };
}

export async function updateSupabaseAdminUser(input: UpdateAdminUserInput): Promise<UpdateAdminUserResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase غير مهيأ." };
  }

  const result = await invokeAdminFunction<{ user?: AuthUser }>(
    "admin-update-user",
    {
      user_id: input.userId,
      email: input.email.trim(),
      password: input.password?.trim() || undefined,
      role: input.role,
      full_name: input.fullName.trim(),
      full_name_ar: input.fullNameAr?.trim() || input.fullName.trim(),
      full_name_en: input.fullNameEn?.trim() || "",
      identifier: input.identifier.trim(),
      department: input.department.trim(),
      role_title: input.roleTitle.trim(),
      level: input.level?.trim() || undefined,
      semester: input.semester?.trim() || undefined,
      force_password_change: input.forcePasswordChange === true,
    },
    "تعذر تحديث المستخدم.",
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  if (!result.data?.user) {
    return { ok: false, error: "تم استلام استجابة غير مكتملة من الخادم." };
  }

  return {
    ok: true,
    user: result.data.user,
  };
}

export async function deleteSupabaseAdminUser(input: DeleteAdminUserInput): Promise<DeleteAdminUserResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase غير مهيأ." };
  }

  const result = await invokeAdminFunction<{
    deleted_user?: {
      id: string;
      email: string;
      full_name: string;
      role: UserRole;
    };
    impact_summary?: DeleteAdminUserResult["impactSummary"];
  }>(
    "admin-delete-user",
    {
      user_id: input.userId,
    },
    "تعذر حذف المستخدم.",
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  if (!result.data?.deleted_user) {
    return { ok: false, error: "تم استلام استجابة غير مكتملة من الخادم." };
  }

  return {
    ok: true,
    deletedUser: {
      id: result.data.deleted_user.id,
      email: result.data.deleted_user.email,
      academicId: "",
      fullName: result.data.deleted_user.full_name,
      role: result.data.deleted_user.role,
      department: "",
      roleTitle: "",
      mustChangePassword: false,
    },
    impactSummary: result.data.impact_summary,
  };
}
