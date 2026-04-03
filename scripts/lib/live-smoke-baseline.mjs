import { createClient } from "@supabase/supabase-js";

export const DEFAULT_SMOKE_TEACHER_EMAIL = "smoke-teacher@university.edu";
export const DEFAULT_SMOKE_TEACHER_PASSWORD = "TeacherSmoke@123";
export const DEFAULT_SMOKE_STUDENT_EMAIL = "smoke-student@university.edu";
export const DEFAULT_SMOKE_STUDENT_PASSWORD = "StudentSmoke@123";

function createServiceClient(url, serviceRoleKey) {
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function listAuthUsers(serviceClient) {
  const { data, error } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    throw error;
  }

  return data?.users ?? [];
}

async function ensureAuthUser(serviceClient, { email, password, fullName }) {
  const users = await listAuthUsers(serviceClient);
  const existing = users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;

  if (!existing) {
    const { data, error } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error || !data.user) {
      throw error ?? new Error(`Failed to create auth user for ${email}`);
    }

    return data.user;
  }

  const { data, error } = await serviceClient.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: {
      ...(existing.user_metadata ?? {}),
      full_name: fullName,
    },
  });

  if (error || !data.user) {
    throw error ?? new Error(`Failed to update auth user for ${email}`);
  }

  return data.user;
}

async function ensureBaselineSubject(serviceClient) {
  const preferred = await serviceClient
    .from("subjects")
    .select("id,code,name_ar,department,level,semester,status")
    .eq("code", "SE402")
    .maybeSingle();

  if (preferred.error) {
    throw preferred.error;
  }

  if (preferred.data) {
    return preferred.data;
  }

  const fallback = await serviceClient
    .from("subjects")
    .select("id,code,name_ar,department,level,semester,status")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallback.error) {
    throw fallback.error;
  }

  if (fallback.data) {
    return fallback.data;
  }

  const { data, error } = await serviceClient
    .from("subjects")
    .insert({
      code: "SMOKE-BASELINE-SUBJECT",
      name_ar: "Smoke Baseline Subject",
      name_en: "Smoke Baseline Subject",
      department: "Computer College",
      level: "Level 4",
      semester: "First Semester",
      status: "active",
    })
    .select("id,code,name_ar,department,level,semester,status")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create fallback smoke subject");
  }

  return data;
}

async function ensureProfile(serviceClient, profile) {
  const { data, error } = await serviceClient
    .from("profiles")
    .upsert(profile)
    .select("id,email,full_name,role,academic_id,employee_number,department,level,semester")
    .single();

  if (error || !data) {
    throw error ?? new Error(`Failed to upsert profile for ${profile.email}`);
  }

  return data;
}

async function ensureTeacherSubjectMapping(serviceClient, teacherId, subject) {
  const existing = await serviceClient
    .from("teacher_subjects")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("subject_id", subject.id)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    return existing.data;
  }

  const { data, error } = await serviceClient
    .from("teacher_subjects")
    .insert({
      teacher_id: teacherId,
      subject_id: subject.id,
      department: subject.department,
      level: subject.level,
      semester: subject.semester,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create teacher baseline mapping");
  }

  return data;
}

async function ensureStudentSubjectMapping(serviceClient, studentId, subjectId) {
  const existing = await serviceClient
    .from("student_subjects")
    .select("id")
    .eq("student_id", studentId)
    .eq("subject_id", subjectId)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    return existing.data;
  }

  const { data, error } = await serviceClient
    .from("student_subjects")
    .insert({
      student_id: studentId,
      subject_id: subjectId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create student baseline mapping");
  }

  return data;
}

export async function ensureLiveSmokeBaseline({
  url,
  serviceRoleKey,
  teacherEmail = DEFAULT_SMOKE_TEACHER_EMAIL,
  teacherPassword = DEFAULT_SMOKE_TEACHER_PASSWORD,
  studentEmail = DEFAULT_SMOKE_STUDENT_EMAIL,
  studentPassword = DEFAULT_SMOKE_STUDENT_PASSWORD,
} = {}) {
  const serviceClient = createServiceClient(url, serviceRoleKey);
  const subject = await ensureBaselineSubject(serviceClient);

  const teacherAuthUser = await ensureAuthUser(serviceClient, {
    email: teacherEmail,
    password: teacherPassword,
    fullName: "Smoke Test Teacher",
  });

  const teacherProfile = await ensureProfile(serviceClient, {
    id: teacherAuthUser.id,
    email: teacherEmail,
    full_name: "Smoke Test Teacher",
    full_name_ar: "Smoke Test Teacher",
    full_name_en: "Smoke Test Teacher",
    role: "teacher",
    academic_id: "99001001",
    employee_number: "99001001",
    department: subject.department,
    level: subject.level,
    semester: subject.semester,
    role_title: "Teacher",
    first_login: false,
    default_password_flag: false,
    must_change_password: false,
  });

  await ensureTeacherSubjectMapping(serviceClient, teacherProfile.id, subject);

  const studentAuthUser = await ensureAuthUser(serviceClient, {
    email: studentEmail,
    password: studentPassword,
    fullName: "Smoke Test Student",
  });

  const studentProfile = await ensureProfile(serviceClient, {
    id: studentAuthUser.id,
    email: studentEmail,
    full_name: "Smoke Test Student",
    full_name_ar: "Smoke Test Student",
    full_name_en: "Smoke Test Student",
    role: "student",
    academic_id: "209901001",
    employee_number: null,
    department: subject.department,
    level: subject.level,
    semester: subject.semester,
    role_title: "Student",
    first_login: false,
    default_password_flag: false,
    must_change_password: false,
  });

  await ensureStudentSubjectMapping(serviceClient, studentProfile.id, subject.id);

  return {
    serviceClient,
    subject,
    teacher: {
      email: teacherEmail,
      password: teacherPassword,
      profile: teacherProfile,
    },
    student: {
      email: studentEmail,
      password: studentPassword,
      profile: studentProfile,
    },
  };
}
