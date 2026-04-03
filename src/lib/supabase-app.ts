import { supabase } from "@/integrations/supabase/client";
import type { Database, Json, Tables } from "@/integrations/supabase/types";
import {
  getActivityCategoryLabel,
  getActorRoleLabel,
  type ActivityFeedItem,
} from "@/lib/activity-feed";
import type {
  AcademicSubject,
  Assignment,
  AssignmentAttachment,
  OriginalityCheck,
  Review,
  StudentSubjectMapping,
  Submission,
  SubmissionMatch,
  SubmissionEvent,
  SubmissionStatus,
  TeacherSubjectMapping,
} from "@/lib/academic-data";
import type { AuthUser, UserRole } from "@/lib/auth";
import {
  normalizeSystemSettings,
  type SystemSettings,
} from "@/lib/system-settings";

type ProfileRow = Tables<"profiles">;
type SubjectRow = Tables<"subjects">;
type StudentSubjectRow = Tables<"student_subjects">;
type TeacherSubjectRow = Tables<"teacher_subjects">;
type ActivityLogRow = Tables<"activity_logs">;
type AssignmentRow = Tables<"assignments">;
type NotificationReadRow = Tables<"notification_reads">;
type OriginalityCheckRow = Tables<"originality_checks">;
type ReviewRow = Tables<"reviews">;
type SubmissionMatchRow = Tables<"submission_matches">;
type SubmissionRow = Tables<"submissions">;
type SystemSettingsRow = Tables<"system_settings">;
type AccessibleReviewRow = Database["public"]["Functions"]["get_accessible_reviews"]["Returns"][number];

interface SupabaseIdentifierSignInInput {
  identifier: string;
  password: string;
}

export interface CreateSupabaseAdminUserInput {
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

interface SupabaseIdentifierSignInResult {
  ok: boolean;
  user?: AuthUser;
  error?: string;
}

export interface SupabaseAcademicData {
  activityFeed: ActivityFeedItem[];
  assignments: Assignment[];
  originalityChecks: OriginalityCheck[];
  reviews: Review[];
  studentSubjectMappings: StudentSubjectMapping[];
  submissionMatches: SubmissionMatch[];
  submissions: Submission[];
  subjects: AcademicSubject[];
  teacherSubjectMappings: TeacherSubjectMapping[];
}

export function isSupabaseConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
}

export function isLocalDemoFallbackEnabled() {
  if (!isSupabaseConfigured()) {
    return true;
  }

  return import.meta.env.VITE_ALLOW_LOCAL_DEMO_FALLBACK === "true";
}

function isUserRole(value: unknown): value is UserRole {
  return value === "student" || value === "teacher" || value === "admin";
}

function canReadSubmissionMatches(role: UserRole | null) {
  return role === "teacher" || role === "admin";
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

function mapSupabaseAuthError(message?: string) {
  const normalizedMessage = message?.toLowerCase() ?? "";

  if (normalizedMessage.includes("invalid login credentials")) {
    return "بيانات تسجيل الدخول غير صحيحة.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "يجب تأكيد البريد الإلكتروني قبل تسجيل الدخول.";
  }

  if (normalizedMessage.includes("too many requests")) {
    return "تم تجاوز عدد المحاولات المسموح بها مؤقتاً. حاول لاحقاً.";
  }

  return "تعذر تسجيل الدخول عبر Supabase.";
}

function isSubmissionEventArray(value: Json): value is SubmissionEvent[] {
  return Array.isArray(value);
}

function isStringArray(value: Json): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isAssignmentAttachmentArray(value: Json): value is AssignmentAttachment[] {
  return Array.isArray(value);
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function formatFileSize(fileSize: number) {
  if (fileSize >= 1024 * 1024) {
    return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (fileSize >= 1024) {
    return `${Math.round(fileSize / 1024)} KB`;
  }

  return `${fileSize} B`;
}

function mapNotificationReadRow(row: NotificationReadRow) {
  return {
    id: row.id,
    userId: row.user_id,
    notificationId: row.notification_id,
    readAt: row.read_at,
  };
}

export function mapProfileRowToAuthUser(profile: ProfileRow): AuthUser {
  return {
    id: profile.id,
    academicId: profile.academic_id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as UserRole,
    department: profile.department,
    roleTitle: profile.role_title,
    level: profile.level,
    semester: profile.semester,
    mustChangePassword: profile.must_change_password,
  };
}

async function loadCurrentSupabaseRole(): Promise<UserRole | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return null;
  }

  const metadataRole = authData.user.user_metadata?.role;
  if (isUserRole(metadataRole)) {
    return metadataRole;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return isUserRole(profile.role) ? profile.role : null;
}

export function mapAssignmentRow(row: AssignmentRow): Assignment {
  const attachments = isAssignmentAttachmentArray(row.attachments)
    ? row.attachments
        .map((item, index) => {
          const entry = typeof item === "object" && item !== null ? item as Record<string, Json> : {};
          const fileName =
            typeof entry.fileName === "string"
              ? entry.fileName
              : typeof entry.file_name === "string"
                ? entry.file_name
                : "";

          if (!fileName) {
            return null;
          }

          return {
            id: typeof entry.id === "string" ? entry.id : `attachment-${index + 1}`,
            fileName,
            filePath:
              typeof entry.filePath === "string"
                ? entry.filePath
                : typeof entry.file_path === "string"
                  ? entry.file_path
                  : null,
            fileMimeType:
              typeof entry.fileMimeType === "string"
                ? entry.fileMimeType
                : typeof entry.file_mime_type === "string"
                  ? entry.file_mime_type
                  : "",
            fileSize:
              typeof entry.fileSize === "string"
                ? entry.fileSize
                : typeof entry.file_size === "string"
                  ? entry.file_size
                  : "",
            uploadedAt:
              typeof entry.uploadedAt === "string"
                ? entry.uploadedAt
                : typeof entry.uploaded_at === "string"
                  ? entry.uploaded_at
                  : row.created_at,
          } satisfies AssignmentAttachment;
        })
        .filter((item): item is AssignmentAttachment => item !== null)
    : [];

  return {
    id: row.id,
    subjectId: row.subject_id,
    title: row.title,
    subject: row.subject,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    level: row.level,
    dueAt: row.due_at,
    description: row.description,
    instructions: row.instructions,
    allowedFormats: row.allowed_formats,
    maxSubmissions: row.max_submissions,
    attachments,
    hasAttachment: row.has_attachment || attachments.length > 0,
    resubmissionPolicy: row.resubmission_policy,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapSubjectRow(row: SubjectRow): AcademicSubject {
  return {
    id: row.id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    code: row.code,
    department: row.department,
    level: row.level,
    semester: row.semester,
    status: row.status === "archived" ? "archived" : "active",
  };
}

export function mapTeacherSubjectRow(row: TeacherSubjectRow): TeacherSubjectMapping {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    subjectId: row.subject_id,
    department: row.department,
    level: row.level,
    semester: row.semester,
  };
}

export function mapStudentSubjectRow(row: StudentSubjectRow): StudentSubjectMapping {
  return {
    id: row.id,
    studentId: row.student_id,
    subjectId: row.subject_id,
    createdAt: row.created_at,
  };
}

export function mapActivityLogRow(row: ActivityLogRow): ActivityFeedItem {
  const actorRole =
    row.actor_role === "student"
    || row.actor_role === "teacher"
    || row.actor_role === "admin"
    || row.actor_role === "system"
      ? row.actor_role
      : "system";
  const category =
    row.category === "assignment"
    || row.category === "submission"
    || row.category === "analysis"
    || row.category === "settings"
    || row.category === "review"
      ? row.category
      : "analysis";
  const statusVariant =
    row.status_variant === "draft"
    || row.status_variant === "published"
    || row.status_variant === "submitted"
    || row.status_variant === "review"
    || row.status_variant === "revision"
    || row.status_variant === "graded"
    || row.status_variant === "accepted"
    || row.status_variant === "rejected"
    || row.status_variant === "flagged"
    || row.status_variant === "closed"
      ? row.status_variant
      : "review";
  const priority =
    row.priority === "normal" || row.priority === "attention" || row.priority === "critical"
      ? row.priority
      : "normal";

  return {
    id: row.id,
    actorName: row.actor_name || "النظام",
    actorRole,
    actorRoleLabel: getActorRoleLabel(actorRole),
    action: row.action,
    details: row.details,
    category,
    categoryLabel: getActivityCategoryLabel(category),
    occurredAt: row.occurred_at,
    statusLabel: row.status_label,
    statusVariant,
    priority,
  };
}

export function mapSubmissionRow(row: SubmissionRow): Submission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    studentName: row.student_name,
    academicId: row.academic_id,
    fileName: row.file_name,
    filePath: row.file_path,
    fileMimeType: row.file_mime_type,
    fileSize: row.file_size,
    notes: row.notes,
    submittedAt: row.submitted_at,
    originality: row.originality,
    status: row.status as SubmissionStatus,
    grade: row.grade,
    feedback: row.feedback,
    semester: row.semester,
    analysisStatus: row.analysis_status,
    analysisRequestedAt: row.analysis_requested_at,
    analysisCompletedAt: row.analysis_completed_at,
    analysisError: row.analysis_error,
    latestOriginalityCheckId: row.latest_originality_check_id,
    events: isSubmissionEventArray(row.events) ? row.events : [],
  };
}

export function mapReviewRow(row: ReviewRow | AccessibleReviewRow): Review {
  const rawManualEvaluation =
    typeof row.manual_evaluation === "object" && row.manual_evaluation !== null
      ? row.manual_evaluation as Record<string, Json>
      : {};
  const manualEvaluation: Review["manualEvaluation"] = {
    grade: typeof rawManualEvaluation.grade === "number" ? rawManualEvaluation.grade : null,
    submissionStatus:
      rawManualEvaluation.submissionStatus === "submitted"
      || rawManualEvaluation.submissionStatus === "review"
      || rawManualEvaluation.submissionStatus === "revision"
      || rawManualEvaluation.submissionStatus === "graded"
      || rawManualEvaluation.submissionStatus === "accepted"
      || rawManualEvaluation.submissionStatus === "rejected"
      || rawManualEvaluation.submissionStatus === "flagged"
        ? rawManualEvaluation.submissionStatus
        : "submitted",
    originality: typeof rawManualEvaluation.originality === "number" ? rawManualEvaluation.originality : 0,
    analysisStatus:
      rawManualEvaluation.analysisStatus === "pending"
      || rawManualEvaluation.analysisStatus === "processing"
      || rawManualEvaluation.analysisStatus === "completed"
      || rawManualEvaluation.analysisStatus === "failed"
      || rawManualEvaluation.analysisStatus === "manual_review_required"
        ? rawManualEvaluation.analysisStatus
        : "pending",
  };

  return {
    id: row.id,
    submissionId: row.submission_id,
    teacherId: row.teacher_id,
    comments: row.comments,
    finalDecision: row.final_decision,
    reviewedAt: row.reviewed_at,
    manualEvaluation,
    appealStatus: row.appeal_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapOriginalityCheckRow(row: OriginalityCheckRow): OriginalityCheck {
  const reasoningNotes = isStringArray(row.reasoning_notes) ? row.reasoning_notes : [];
  const suspiciousSections = Array.isArray(row.suspicious_sections)
    ? row.suspicious_sections
        .map((item) => {
          const entry = typeof item === "object" && item !== null ? item as Record<string, Json> : {};

          return {
            sectionText: typeof entry.section_text === "string" ? entry.section_text : "",
            matchType:
              entry.match_type === "literal"
              || entry.match_type === "paraphrased"
              || entry.match_type === "common_overlap"
              || entry.match_type === "citation_overlap"
                ? entry.match_type
                : "common_overlap",
            matchedReferenceId:
              typeof entry.matched_reference_id === "string" ? entry.matched_reference_id : "",
            reason: typeof entry.reason === "string" ? entry.reason : "",
            similarityScore:
              typeof entry.similarity_score === "number" ? entry.similarity_score : 0,
          };
        })
        .filter((item) => item.sectionText || item.reason)
    : [];

  return {
    id: row.id,
    submissionId: row.submission_id,
    originalityScore: row.originality_score,
    matchingPercentage: row.matching_percentage,
    riskLevel: row.risk_level,
    recommendedStatus: row.recommended_status,
    summaryForTeacher: row.summary_for_teacher,
    summaryForStudent: row.summary_for_student,
    summaryForAdmin: row.summary_for_admin,
    confidenceScore: row.confidence_score,
    reasoningNotes,
    suspiciousSections,
    analysisStatus: row.analysis_status,
    modelName: row.model_name,
    promptVersion: row.prompt_version,
    analyzedAt: row.analyzed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSubmissionMatchRow(row: SubmissionMatchRow): SubmissionMatch {
  return {
    id: row.id,
    originalityCheckId: row.originality_check_id,
    submissionId: row.submission_id,
    matchedSubmissionId: row.matched_submission_id,
    matchedStudentId: row.matched_student_id,
    matchedStudentName: row.matched_student_name,
    matchedAssignmentId: row.matched_assignment_id,
    matchedSubjectId: row.matched_subject_id,
    similarityScore: row.similarity_score,
    matchType: row.match_type,
    matchedExcerpt: row.matched_excerpt,
    sectionText: row.section_text,
    sourceScope: row.source_scope,
    rankOrder: row.rank_order,
    createdAt: row.created_at,
  };
}

export function mapSystemSettingsRow(row: SystemSettingsRow): SystemSettings {
  return normalizeSystemSettings({
    institutionName: row.institution_name,
    academicYear: row.academic_year,
    maxUploadSizeMb: row.max_upload_size_mb,
    allowedSubmissionFormats: row.allowed_submission_formats,
    mediumRiskBelow: row.medium_risk_below,
    highRiskBelow: row.high_risk_below,
    suspiciousAlertBelow: row.suspicious_alert_below,
    manualReviewOnExtractionFailure: row.manual_review_on_extraction_failure,
    autoStartAnalysis: row.auto_start_analysis,
  });
}

export async function getSupabaseSessionProfile() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return mapProfileRowToAuthUser(data);
}

export async function loadAccessibleProfiles() {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const currentRole = await loadCurrentSupabaseRole();

  if (currentRole !== "admin") {
    const currentProfile = await getSupabaseSessionProfile();
    return currentProfile ? [currentProfile] : [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(mapProfileRowToAuthUser);
}

export async function createSupabaseAdminUser(input: CreateSupabaseAdminUserInput) {
  if (!isSupabaseConfigured()) {
    return { ok: false as const, error: "Supabase غير مهيأ." };
  }

  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: {
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
  });

  if (error) {
    const message = error.context ? await error.context.text() : error.message;

    try {
      const parsed = JSON.parse(message) as { error?: string };
      return {
        ok: false as const,
        error: parsed.error ?? "تعذر إنشاء المستخدم.",
      };
    } catch {
      return {
        ok: false as const,
        error: message || "تعذر إنشاء المستخدم.",
      };
    }
  }

  const candidate = typeof data === "object" && data !== null ? data as {
    user?: AuthUser;
  } : {};

  if (!candidate.user) {
    return { ok: false as const, error: "تم استلام استجابة غير مكتملة من الخادم." };
  }

  return {
    ok: true as const,
    user: candidate.user,
  };
}

export async function loadSupabaseSystemSettings() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapSystemSettingsRow(data);
}

export async function updateSupabaseSystemSettings(
  settings: SystemSettings,
  updatedBy?: string,
) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const normalized = normalizeSystemSettings(settings);
  const { data, error } = await supabase
    .from("system_settings")
    .upsert({
      id: true,
      institution_name: normalized.institutionName,
      academic_year: normalized.academicYear,
      max_upload_size_mb: normalized.maxUploadSizeMb,
      allowed_submission_formats: normalized.allowedSubmissionFormats,
      medium_risk_below: normalized.mediumRiskBelow,
      high_risk_below: normalized.highRiskBelow,
      suspicious_alert_below: normalized.suspiciousAlertBelow,
      manual_review_on_extraction_failure: normalized.manualReviewOnExtractionFailure,
      auto_start_analysis: normalized.autoStartAnalysis,
      updated_by: updatedBy ?? null,
    }, {
      onConflict: "id",
    })
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  return mapSystemSettingsRow(data);
}

export async function resolveSupabaseLoginIdentifier(identifier: string) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) {
    return null;
  }

  if (normalizedIdentifier.includes("@")) {
    return normalizedIdentifier;
  }

  const { data, error } = await supabase.rpc("resolve_login_identifier", {
    lookup_identifier: normalizedIdentifier,
  });

  if (error || typeof data !== "string" || !data) {
    return null;
  }

  return data;
}

export async function signInWithSupabaseIdentifier({
  identifier,
  password,
}: SupabaseIdentifierSignInInput): Promise<SupabaseIdentifierSignInResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase غير مهيأ." };
  }

  const email = await resolveSupabaseLoginIdentifier(identifier);
  if (!email) {
    return { ok: false, error: "بيانات تسجيل الدخول غير صحيحة." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session?.user) {
    return { ok: false, error: mapSupabaseAuthError(error?.message) };
  }

  const profile = await getSupabaseSessionProfile();
  if (!profile) {
    return { ok: false, error: "تم تسجيل الدخول ولكن تعذر تحميل ملف المستخدم." };
  }

  return {
    ok: true,
    user: profile,
  };
}

export async function loadSupabaseAcademicData(): Promise<SupabaseAcademicData | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const currentRole = await loadCurrentSupabaseRole();

  const [
    assignmentsResult,
    originalityChecksResult,
    subjectsResult,
    submissionsResult,
    reviewsResult,
  ] = await Promise.all([
    supabase.from("assignments").select("*").order("created_at", { ascending: false }),
    supabase.rpc("get_accessible_originality_checks"),
    supabase.from("subjects").select("*").order("name_ar", { ascending: true }),
    supabase.from("submissions").select("*").order("submitted_at", { ascending: false }),
    supabase.rpc("get_accessible_reviews"),
  ]);

  const submissionMatchesResult = canReadSubmissionMatches(currentRole)
    ? await supabase
        .from("submission_matches")
        .select("*")
        .order("rank_order", { ascending: true })
    : null;
  const teacherSubjectsResult = currentRole === "teacher" || currentRole === "admin"
    ? await supabase
        .from("teacher_subjects")
        .select("*")
        .order("created_at", { ascending: true })
    : null;
  const studentSubjectsResult = currentRole === "student" || currentRole === "admin"
    ? await supabase
        .from("student_subjects")
        .select("*")
        .order("created_at", { ascending: true })
    : null;

  if (
    assignmentsResult.error
    || originalityChecksResult.error
    || subjectsResult.error
    || submissionsResult.error
    || reviewsResult.error
    || studentSubjectsResult?.error
    || submissionMatchesResult?.error
    || teacherSubjectsResult?.error
  ) {
    return null;
  }

  const activityLogsResult = currentRole === "admin"
    ? await supabase
        .from("activity_logs")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(200)
    : null;

  return {
    activityFeed:
      !activityLogsResult || activityLogsResult.error
        ? []
        : (activityLogsResult.data ?? []).map(mapActivityLogRow),
    assignments: (assignmentsResult.data ?? []).map(mapAssignmentRow),
    originalityChecks: (originalityChecksResult.data ?? []).map(mapOriginalityCheckRow),
    reviews: (reviewsResult.data ?? []).map(mapReviewRow),
    studentSubjectMappings: (studentSubjectsResult?.data ?? []).map(mapStudentSubjectRow),
    submissionMatches: (submissionMatchesResult?.data ?? []).map(mapSubmissionMatchRow),
    submissions: (submissionsResult.data ?? []).map(mapSubmissionRow),
    subjects: (subjectsResult.data ?? []).map(mapSubjectRow),
    teacherSubjectMappings: (teacherSubjectsResult?.data ?? []).map(mapTeacherSubjectRow),
  };
}

export async function createSupabaseSubject(input: {
  nameAr: string;
  nameEn: string;
  code: string;
  department: string;
  level: string;
  semester: string;
  status?: AcademicSubject["status"];
}) {
  const { data, error } = await supabase
    .from("subjects")
    .insert({
      name_ar: input.nameAr,
      name_en: input.nameEn,
      code: input.code,
      department: input.department,
      level: input.level,
      semester: input.semester,
      status: input.status ?? "active",
    })
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  return mapSubjectRow(data);
}

export async function updateSupabaseSubject(input: AcademicSubject) {
  const { data, error } = await supabase
    .from("subjects")
    .update({
      name_ar: input.nameAr,
      name_en: input.nameEn,
      code: input.code,
      department: input.department,
      level: input.level,
      semester: input.semester,
      status: input.status,
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  void supabase
    .from("teacher_subjects")
    .update({
      department: data.department,
      level: data.level,
      semester: data.semester,
    })
    .eq("subject_id", data.id);

  void supabase
    .from("assignments")
    .update({
      subject: data.name_ar,
      level: data.level,
    })
    .eq("subject_id", data.id);

  return mapSubjectRow(data);
}

export async function ensureSupabaseStudentSubjectMapping(input: {
  studentId: string;
  subjectId: string;
}) {
  const { data: existingRow, error: existingError } = await supabase
    .from("student_subjects")
    .select("*")
    .eq("student_id", input.studentId)
    .eq("subject_id", input.subjectId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return null;
  }

  if (existingRow) {
    return mapStudentSubjectRow(existingRow);
  }

  const { data, error } = await supabase
    .from("student_subjects")
    .insert({
      student_id: input.studentId,
      subject_id: input.subjectId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  return mapStudentSubjectRow(data);
}

export async function removeSupabaseStudentSubjectMapping(mappingId: string) {
  const { error } = await supabase
    .from("student_subjects")
    .delete()
    .eq("id", mappingId);

  return !error;
}

export async function deleteSupabaseSubject(subjectId: string) {
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      error: "Supabase غير مهيأ.",
    };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    return {
      ok: false as const,
      error: "تعذر التحقق من جلسة الإدارة الحالية.",
    };
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-subject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      subject_id: subjectId,
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      return {
        ok: false as const,
        error: parsed.error ?? "تعذر حذف المادة.",
      };
    } catch {
      return {
        ok: false as const,
        error: raw || "تعذر حذف المادة.",
      };
    }
  }

  return { ok: true as const };
}

export async function ensureSupabaseTeacherSubjectMapping(input: {
  teacherId: string;
  subject: AcademicSubject;
}) {
  const { data: existingRow, error: existingError } = await supabase
    .from("teacher_subjects")
    .select("*")
    .eq("teacher_id", input.teacherId)
    .eq("subject_id", input.subject.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return null;
  }

  if (existingRow) {
    return mapTeacherSubjectRow(existingRow);
  }

  const { data, error } = await supabase
    .from("teacher_subjects")
    .insert({
      teacher_id: input.teacherId,
      subject_id: input.subject.id,
      department: input.subject.department,
      level: input.subject.level,
      semester: input.subject.semester,
    })
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  return mapTeacherSubjectRow(data);
}

export async function removeSupabaseTeacherSubjectMapping(mappingId: string) {
  const { error } = await supabase
    .from("teacher_subjects")
    .delete()
    .eq("id", mappingId);

  return !error;
}

export async function loadSupabaseNotificationReadIds() {
  const { data, error } = await supabase
    .from("notification_reads")
    .select("*")
    .order("read_at", { ascending: false });

  if (error || !data) {
    return null;
  }

  return data.map(mapNotificationReadRow).map((row) => row.notificationId);
}

export async function upsertSupabaseNotificationReads(notificationIds: string[]) {
  const uniqueNotificationIds = Array.from(
    new Set(notificationIds.map((value) => value.trim()).filter(Boolean)),
  );

  if (uniqueNotificationIds.length === 0) {
    return true;
  }

  const { data: authResult, error: authError } = await supabase.auth.getUser();
  const userId = authResult.user?.id;

  if (authError || !userId) {
    return false;
  }

  const payload = uniqueNotificationIds.map((notificationId) => ({
    user_id: userId,
    notification_id: notificationId,
    read_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("notification_reads")
    .upsert(payload, {
      onConflict: "user_id,notification_id",
    });

  return !error;
}

export async function createSupabaseAssignment(input: Omit<Assignment, "id">) {
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      title: input.title,
      subject: input.subject,
      subject_id: input.subjectId,
      teacher_id: input.teacherId,
      teacher_name: input.teacherName,
      level: input.level,
      due_at: input.dueAt,
      due_time: new Date(input.dueAt).toISOString().slice(11, 19),
      description: input.description,
      instructions: input.instructions,
      allowed_formats: input.allowedFormats,
      max_submissions: input.maxSubmissions,
      attachments: input.attachments as unknown as Json,
      has_attachment: input.attachments.length > 0 || input.hasAttachment,
      resubmission_policy: input.resubmissionPolicy,
      status: input.status,
      created_at: input.createdAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  return mapAssignmentRow(data);
}

export async function uploadSupabaseAssignmentAttachments(input: {
  userId: string;
  files: File[];
}) {
  const uploadedPaths: string[] = [];
  const attachments: AssignmentAttachment[] = [];

  for (const file of input.files) {
    const safeName = sanitizeFileName(file.name);
    const filePath = `${input.userId}/attachments/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from("assignment-attachments")
      .upload(filePath, file, {
        cacheControl: "3600",
        contentType: file.type || undefined,
        upsert: false,
      });

    if (error) {
      if (uploadedPaths.length > 0) {
        void supabase.storage.from("assignment-attachments").remove(uploadedPaths);
      }
      return null;
    }

    uploadedPaths.push(filePath);
    attachments.push({
      id: globalThis.crypto?.randomUUID?.() ?? `attachment-${Date.now()}-${attachments.length + 1}`,
      fileName: file.name,
      filePath,
      fileMimeType: file.type || "",
      fileSize: formatFileSize(file.size),
      uploadedAt: new Date().toISOString(),
    });
  }

  return attachments;
}

export async function removeSupabaseAssignmentAttachments(paths: string[]) {
  if (paths.length === 0) {
    return true;
  }

  const { error } = await supabase.storage.from("assignment-attachments").remove(paths);
  return !error;
}

export async function createAssignmentAttachmentSignedUrl(filePath: string) {
  const { data, error } = await supabase.storage
    .from("assignment-attachments")
    .createSignedUrl(filePath, 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function createSupabaseSubmissionSignedUrl(
  filePath: string,
  expiresInSeconds = 60,
) {
  const { data, error } = await supabase.storage
    .from("student-submissions")
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function uploadSupabaseSubmissionFile(input: {
  userId: string;
  assignmentId: string;
  file: File;
  previousPath?: string | null;
}) {
  const safeName = sanitizeFileName(input.file.name);
  const filePath = `${input.userId}/${input.assignmentId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("student-submissions")
    .upload(filePath, input.file, {
      cacheControl: "3600",
      contentType: input.file.type || undefined,
      upsert: false,
    });

  if (error) {
    return null;
  }

  if (input.previousPath && input.previousPath !== filePath) {
    void supabase.storage.from("student-submissions").remove([input.previousPath]);
  }

  return {
    fileName: input.file.name,
    filePath,
    fileMimeType: input.file.type || "",
    fileSize: formatFileSize(input.file.size),
  };
}

export async function getSupabaseSubmissionById(submissionId: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapSubmissionRow(data);
}

export async function upsertSupabaseSubmission(input: Submission) {
  const { data, error } = await supabase
    .from("submissions")
    .upsert({
      id: input.id,
      assignment_id: input.assignmentId,
      student_id: input.studentId,
      student_name: input.studentName,
      academic_id: input.academicId,
      file_name: input.fileName,
      file_path: input.filePath,
      file_mime_type: input.fileMimeType,
      file_size: input.fileSize,
      notes: input.notes,
      submitted_at: input.submittedAt,
      originality: input.originality,
      status: input.status,
      grade: input.grade,
      feedback: input.feedback,
      semester: input.semester,
      analysis_status: input.analysisStatus,
      analysis_requested_at: input.analysisRequestedAt,
      analysis_completed_at: input.analysisCompletedAt,
      analysis_error: input.analysisError,
      latest_originality_check_id: input.latestOriginalityCheckId,
      events: input.events,
    })
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  return mapSubmissionRow(data);
}

export async function requestSupabaseSubmissionAnalysis(submissionId: string) {
  const { data, error } = await supabase.functions.invoke("analyze-submission", {
    body: { submission_id: submissionId },
  });

  if (error) {
    const payloadError =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : null;

    return {
      submission: null,
      error: payloadError ?? error.message ?? "تعذر تشغيل تحليل الأصالة لهذا التسليم.",
    };
  }

  const submission = await getSupabaseSubmissionById(submissionId);
  if (!submission) {
    return {
      submission: null,
      error: "تم تشغيل التحليل لكن تعذر تحديث حالة التسليم من قاعدة البيانات.",
    };
  }

  return {
    submission,
    error: null,
  };
}

export async function clearSupabaseSubmissionArtifacts(submissionId: string) {
  const [matchesResult, checksResult, reviewsResult] = await Promise.all([
    supabase.from("submission_matches").delete().eq("submission_id", submissionId),
    supabase.from("originality_checks").delete().eq("submission_id", submissionId),
    supabase.from("reviews").delete().eq("submission_id", submissionId),
  ]);

  return !matchesResult.error && !checksResult.error && !reviewsResult.error;
}

export async function updateSupabaseSubmissionReview(
  input: {
    submissionId: string;
    teacherId: string;
    status: SubmissionStatus;
    grade: number | null;
    feedback: string;
    events: SubmissionEvent[];
    reviewId?: string;
    finalDecision: Review["finalDecision"];
    reviewedAt: string;
    manualEvaluation: Review["manualEvaluation"];
  },
) {
  const [submissionResult, reviewResult] = await Promise.all([
    supabase
      .from("submissions")
      .update({
        status: input.status,
        grade: input.grade,
        feedback: input.feedback,
        events: input.events,
      })
      .eq("id", input.submissionId)
      .select("*")
      .single(),
    supabase
      .from("reviews")
      .upsert({
        id: input.reviewId,
        submission_id: input.submissionId,
        teacher_id: input.teacherId,
        comments: input.feedback,
        final_decision: input.finalDecision,
        reviewed_at: input.reviewedAt,
        manual_evaluation: input.manualEvaluation as unknown as Json,
        appeal_status: "none",
        updated_at: input.reviewedAt,
      }, {
        onConflict: "submission_id",
      })
      .select("*")
      .single(),
  ]);

  if (submissionResult.error || !submissionResult.data || reviewResult.error || !reviewResult.data) {
    return null;
  }

  return {
    submission: mapSubmissionRow(submissionResult.data),
    review: mapReviewRow(reviewResult.data),
  };
}

export async function updateSupabasePasswordState(userId: string, newPassword: string) {
  const passwordResult = await supabase.auth.updateUser({ password: newPassword });
  if (passwordResult.error) {
    return { ok: false, error: passwordResult.error.message };
  }

  const profileResult = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", userId);

  if (profileResult.error) {
    return { ok: false, error: profileResult.error.message };
  }

  return { ok: true };
}
