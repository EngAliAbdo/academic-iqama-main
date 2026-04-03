import { supabase } from "@/integrations/supabase/client";
import type { AuthUser, UserRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase-app";

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

export async function createSupabaseAdminUser(input: CreateAdminUserInput): Promise<CreateAdminUserResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase غير مهيأ." };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    return { ok: false, error: "تعذر التحقق من جلسة الإدارة الحالية." };
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
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
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      return {
        ok: false,
        error: parsed.error ?? "تعذر إنشاء المستخدم.",
      };
    } catch {
      return {
        ok: false,
        error: raw || "تعذر إنشاء المستخدم.",
      };
    }
  }

  const parsed = raw ? JSON.parse(raw) as { user?: AuthUser } : {};

  if (!parsed.user) {
    return { ok: false, error: "تم استلام استجابة غير مكتملة من الخادم." };
  }

  return {
    ok: true,
    user: parsed.user,
  };
}

export async function updateSupabaseAdminUser(input: UpdateAdminUserInput): Promise<UpdateAdminUserResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase غير مهيأ." };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    return { ok: false, error: "تعذر التحقق من جلسة الإدارة الحالية." };
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
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
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      return {
        ok: false,
        error: parsed.error ?? "تعذر تحديث المستخدم.",
      };
    } catch {
      return {
        ok: false,
        error: raw || "تعذر تحديث المستخدم.",
      };
    }
  }

  const parsed = raw ? JSON.parse(raw) as { user?: AuthUser } : {};
  if (!parsed.user) {
    return { ok: false, error: "تم استلام استجابة غير مكتملة من الخادم." };
  }

  return {
    ok: true,
    user: parsed.user,
  };
}

export async function deleteSupabaseAdminUser(input: DeleteAdminUserInput): Promise<DeleteAdminUserResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase غير مهيأ." };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    return { ok: false, error: "تعذر التحقق من جلسة الإدارة الحالية." };
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      user_id: input.userId,
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      return {
        ok: false,
        error: parsed.error ?? "تعذر حذف المستخدم.",
      };
    } catch {
      return {
        ok: false,
        error: raw || "تعذر حذف المستخدم.",
      };
    }
  }

  const parsed = raw ? JSON.parse(raw) as {
    deleted_user?: {
      id: string;
      email: string;
      full_name: string;
      role: UserRole;
    };
    impact_summary?: DeleteAdminUserResult["impactSummary"];
  } : {};

  if (!parsed.deleted_user) {
    return { ok: false, error: "تم استلام استجابة غير مكتملة من الخادم." };
  }

  return {
    ok: true,
    deletedUser: {
      id: parsed.deleted_user.id,
      email: parsed.deleted_user.email,
      academicId: "",
      fullName: parsed.deleted_user.full_name,
      role: parsed.deleted_user.role,
      department: "",
      roleTitle: "",
      mustChangePassword: false,
    },
    impactSummary: parsed.impact_summary,
  };
}
