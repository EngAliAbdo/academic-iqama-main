import { getOriginalityPolicySnapshot } from "@/lib/system-settings";
import { ACADEMIC_SUBJECT_SEEDS } from "@/lib/academic-catalog";

export type AssignmentStatus = "draft" | "published" | "closed";
export type SubmissionStatus =
  | "submitted"
  | "review"
  | "revision"
  | "graded"
  | "accepted"
  | "rejected"
  | "flagged";
export type SubmissionAnalysisStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "manual_review_required";
export type OriginalityRiskLevel = "low" | "medium" | "high" | "manual" | "pending";
export type ReviewFinalDecision = "accepted" | "rejected" | "revision";
export type OriginalityRecommendedStatus = "clean" | "review" | "flagged";
export type MatchType = "literal" | "paraphrased" | "common_overlap" | "citation_overlap";
export type MatchSourceScope = "same_assignment" | "same_subject" | "same_level_semester";

export interface AssignmentAttachment {
  id: string;
  fileName: string;
  filePath: string | null;
  fileMimeType: string;
  fileSize: string;
  uploadedAt: string;
}

export type SubjectStatus = "active" | "archived";

export interface AcademicSubject {
  id: string;
  nameAr: string;
  nameEn: string;
  code: string;
  department: string;
  level: string;
  semester: string;
  status: SubjectStatus;
}

export interface TeacherSubjectMapping {
  id: string;
  teacherId: string;
  subjectId: string;
  department: string;
  level: string;
  semester: string;
}

export interface StudentSubjectMapping {
  id: string;
  studentId: string;
  subjectId: string;
  createdAt: string;
}

export interface Assignment {
  id: string;
  subjectId: string | null;
  title: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  level: string;
  dueAt: string;
  description: string;
  instructions: string;
  allowedFormats: string[];
  maxSubmissions: number;
  attachments: AssignmentAttachment[];
  hasAttachment: boolean;
  resubmissionPolicy: string;
  status: AssignmentStatus;
  createdAt: string;
}

export interface SubmissionEvent {
  key: string;
  label: string;
  at: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  academicId: string;
  fileName: string;
  filePath: string | null;
  fileMimeType: string;
  fileSize: string;
  notes: string;
  submittedAt: string;
  originality: number;
  status: SubmissionStatus;
  grade: number | null;
  feedback: string;
  semester: string;
  analysisStatus: SubmissionAnalysisStatus;
  analysisRequestedAt: string | null;
  analysisCompletedAt: string | null;
  analysisError: string;
  latestOriginalityCheckId: string | null;
  events: SubmissionEvent[];
}

export interface ReviewManualEvaluation {
  grade: number | null;
  submissionStatus: SubmissionStatus;
  originality: number;
  analysisStatus: SubmissionAnalysisStatus;
}

export interface Review {
  id: string;
  submissionId: string;
  teacherId: string;
  comments: string;
  finalDecision: ReviewFinalDecision | null;
  reviewedAt: string | null;
  manualEvaluation: ReviewManualEvaluation;
  appealStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface OriginalitySuspiciousSection {
  sectionText: string;
  matchType: MatchType;
  matchedReferenceId: string;
  reason: string;
  similarityScore: number;
}

export interface OriginalityCheck {
  id: string;
  submissionId: string;
  originalityScore: number;
  matchingPercentage: number;
  riskLevel: "low" | "medium" | "high";
  recommendedStatus: OriginalityRecommendedStatus;
  summaryForTeacher: string;
  summaryForStudent: string;
  summaryForAdmin: string;
  confidenceScore: number;
  reasoningNotes: string[];
  suspiciousSections: OriginalitySuspiciousSection[];
  analysisStatus: SubmissionAnalysisStatus;
  modelName: string;
  promptVersion: string;
  analyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionMatch {
  id: string;
  originalityCheckId: string;
  submissionId: string;
  matchedSubmissionId: string | null;
  matchedStudentId: string | null;
  matchedStudentName: string;
  matchedAssignmentId: string | null;
  matchedSubjectId: string | null;
  similarityScore: number;
  matchType: MatchType;
  matchedExcerpt: string;
  sectionText: string;
  sourceScope: MatchSourceScope;
  rankOrder: number;
  createdAt: string;
}

export const ACADEMIC_DATA_STORAGE_KEY = "academic-iqama.academic-data";

export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function formatDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function getAnalysisDurationSeconds(
  startAt: string | null,
  endAt: string | null,
  now = new Date(),
) {
  if (!startAt) {
    return null;
  }

  const startTime = Date.parse(startAt);
  const endTime = Date.parse(endAt ?? now.toISOString());

  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) {
    return null;
  }

  return Math.max(0, Math.round((endTime - startTime) / 1000));
}

export function formatDurationSeconds(totalSeconds: number | null) {
  if (totalSeconds === null || totalSeconds < 0) {
    return null;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} س ${minutes} د`;
  }

  if (minutes > 0) {
    return `${minutes} د ${seconds} ث`;
  }

  return `${seconds} ث`;
}

export function formatAnalysisDuration(
  startAt: string | null,
  endAt: string | null,
  now = new Date(),
) {
  if (!startAt) {
    return null;
  }

  const startTime = Date.parse(startAt);
  const endTime = Date.parse(endAt ?? now.toISOString());

  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.round((endTime - startTime) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} س ${minutes} د`;
  }

  if (minutes > 0) {
    return `${minutes} د ${seconds} ث`;
  }

  return `${seconds} ث`;
}

export function normalizeAssignmentAttachments(value: unknown): AssignmentAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const entry = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
      const fileName = typeof entry.fileName === "string"
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
            : new Date().toISOString(),
      } satisfies AssignmentAttachment;
    })
    .filter((item): item is AssignmentAttachment => item !== null);
}

export function normalizeAssignment(assignment: Assignment): Assignment {
  const attachments = normalizeAssignmentAttachments(assignment.attachments);

  return {
    ...assignment,
    attachments,
    hasAttachment: attachments.length > 0 || assignment.hasAttachment,
    resubmissionPolicy: assignment.resubmissionPolicy || "replace_latest",
  };
}

export function canStudentAccessAssignmentWithMappings(
  assignment: Pick<Assignment, "subjectId">,
  mappings: Pick<StudentSubjectMapping, "studentId" | "subjectId">[],
  studentId: string,
) {
  if (!assignment.subjectId) {
    return true;
  }

  const subjectMappings = mappings.filter((mapping) => mapping.subjectId === assignment.subjectId);
  if (subjectMappings.length === 0) {
    return true;
  }

  const studentMappings = subjectMappings.filter((mapping) => mapping.studentId === studentId);
  if (studentMappings.length === 0) {
    return false;
  }

  return true;
}

function sanitizeSubjectKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDerivedSubjectId(subjectName: string) {
  const normalized = sanitizeSubjectKey(subjectName);
  return normalized ? `subject-${normalized}` : `subject-${Date.now()}`;
}

export function deriveSubjectsFromAssignments(assignments: Assignment[]): AcademicSubject[] {
  const grouped = new Map<string, AcademicSubject>();

  assignments.forEach((assignment) => {
    const subjectName = assignment.subject.trim() || "غير محدد";
    const subjectId = assignment.subjectId ?? buildDerivedSubjectId(subjectName);
    const existing = grouped.get(subjectId);

    if (existing) {
      if (!existing.level && assignment.level) {
        existing.level = assignment.level;
      }
      return;
    }

    grouped.set(subjectId, {
      id: subjectId,
      nameAr: subjectName,
      nameEn: "",
      code: "",
      department: "",
      level: assignment.level,
      semester: "الفصل الثاني 1447",
      status: "active",
    });
  });

  return Array.from(grouped.values()).sort((left, right) =>
    left.nameAr.localeCompare(right.nameAr, "ar"));
}

export function deriveTeacherSubjectMappings(
  assignments: Assignment[],
  subjects: AcademicSubject[],
): TeacherSubjectMapping[] {
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
  const seen = new Set<string>();

  return assignments.flatMap((assignment) => {
    const subjectId = assignment.subjectId ?? buildDerivedSubjectId(assignment.subject);
    const key = `${assignment.teacherId}:${subjectId}`;
    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    const subject = subjectMap.get(subjectId);

    return [{
      id: `mapping-${key}`,
      teacherId: assignment.teacherId,
      subjectId,
      department: subject?.department ?? "",
      level: subject?.level ?? assignment.level,
      semester: subject?.semester ?? "الفصل الثاني 1447",
    }];
  });
}

export function deriveStudentSubjectMappings(
  assignments: Assignment[],
  submissions: Submission[],
): StudentSubjectMapping[] {
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const seen = new Set<string>();

  return submissions.flatMap((submission) => {
    const assignment = assignmentMap.get(submission.assignmentId);
    if (!assignment) {
      return [];
    }

    const subjectId = assignment.subjectId ?? buildDerivedSubjectId(assignment.subject);
    const key = `${submission.studentId}:${subjectId}`;
    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [{
      id: `student-subject-${key}`,
      studentId: submission.studentId,
      subjectId,
      createdAt: submission.submittedAt,
    }];
  });
}

export function isDueSoon(dueAt: string) {
  const diff = new Date(dueAt).getTime() - Date.now();
  return diff > 0 && diff <= 1000 * 60 * 60 * 24 * 3;
}

export function createSubmissionEvents(
  submittedAt: string,
  status: SubmissionStatus,
  reviewedAt?: string,
  gradedAt?: string,
) {
  const reviewTimestamp = reviewedAt ?? submittedAt;
  const gradingTimestamp = gradedAt ?? reviewTimestamp;

  return [
    { key: "submitted", label: "تم الرفع", at: submittedAt },
    { key: "queued", label: "تم الاستلام", at: reviewTimestamp },
    { key: "originality", label: "فحص الأصالة", at: reviewTimestamp },
    { key: "teacher-review", label: "مراجعة المعلم", at: reviewTimestamp },
    {
      key: "graded",
      label:
        status === "revision"
          ? "يحتاج تعديل"
          : status === "rejected"
            ? "غير مقبول"
            : status === "accepted"
              ? "مقبول"
              : status === "flagged"
                ? "تم تمييزه كمشتبه"
                : "تم التقييم",
      at: gradingTimestamp,
    },
  ];
}

export function getSubmissionBadgeVariant(status: SubmissionStatus) {
  return status;
}

export function getSubmissionAnalysisStatusLabel(status: SubmissionAnalysisStatus) {
  return {
    pending: "بانتظار التحليل",
    processing: "قيد التحليل",
    completed: "تم التحليل",
    failed: "فشل التحليل",
    manual_review_required: "مراجعة يدوية",
  }[status];
}

export function isAnalysisPending(status: SubmissionAnalysisStatus) {
  return status === "pending" || status === "processing";
}

export function getOriginalityRiskLevel(
  submission: Pick<Submission, "status" | "originality" | "analysisStatus">,
): OriginalityRiskLevel {
  const { highRiskBelow, mediumRiskBelow } = getOriginalityPolicySnapshot();

  if (submission.analysisStatus === "manual_review_required") {
    return "manual";
  }

  if (isAnalysisPending(submission.analysisStatus)) {
    return "pending";
  }

  if (submission.status === "flagged" || submission.originality < highRiskBelow) {
    return "high";
  }

  if (submission.originality < mediumRiskBelow) {
    return "medium";
  }

  return "low";
}

export function getOriginalityRiskLabel(riskLevel: OriginalityRiskLevel) {
  return {
    low: "خطورة منخفضة",
    medium: "خطورة متوسطة",
    high: "خطورة مرتفعة",
    manual: "مراجعة يدوية",
    pending: "قيد التحليل",
  }[riskLevel];
}

export function getOriginalityRecommendedStatusLabel(status: OriginalityRecommendedStatus) {
  return {
    clean: "سليم",
    review: "يحتاج مراجعة",
    flagged: "مشتبه",
  }[status];
}

export function getMatchTypeLabel(matchType: MatchType) {
  return {
    literal: "تشابه حرفي",
    paraphrased: "إعادة صياغة",
    common_overlap: "تشابه أكاديمي عام",
    citation_overlap: "تشابه استشهادات",
  }[matchType];
}

export function getSourceScopeLabel(sourceScope: MatchSourceScope) {
  return {
    same_assignment: "نفس التكليف",
    same_subject: "نفس المادة",
    same_level_semester: "نفس المستوى/الفصل",
  }[sourceScope];
}

export function getReviewDecisionLabel(decision: ReviewFinalDecision | null) {
  if (decision === "accepted") {
    return "مقبول";
  }

  if (decision === "rejected") {
    return "غير مقبول";
  }

  if (decision === "revision") {
    return "يحتاج تعديل";
  }

  return "لم يحدد";
}

export function getSubmissionStatusFromReviewDecision(decision: ReviewFinalDecision): SubmissionStatus {
  return decision;
}

export function isSuspiciousSubmission(
  submission: Pick<Submission, "status" | "originality" | "analysisStatus">,
) {
  const { suspiciousAlertBelow } = getOriginalityPolicySnapshot();
  const riskLevel = getOriginalityRiskLevel(submission);

  return (
    riskLevel === "high"
    || riskLevel === "manual"
    || (!isAnalysisPending(submission.analysisStatus) && submission.originality < suspiciousAlertBelow)
  );
}

export function getSubmissionAttentionPriority(
  submission: Pick<Submission, "status" | "originality" | "analysisStatus">,
) {
  if (submission.analysisStatus === "failed") {
    return 5;
  }

  if (submission.analysisStatus === "manual_review_required") {
    return 4;
  }

  const riskLevel = getOriginalityRiskLevel(submission);

  if (riskLevel === "high") {
    return 3;
  }

  if (isAnalysisPending(submission.analysisStatus)) {
    return 2;
  }

  if (riskLevel === "medium" && isSuspiciousSubmission(submission)) {
    return 1;
  }

  return 0;
}

export function getStudentAssignmentBadge(
  assignment: Assignment,
  submission?: Submission,
):
  | "published"
  | "submitted"
  | "review"
  | "revision"
  | "graded"
  | "accepted"
  | "flagged"
  | "rejected"
  | "due-soon"
  | "closed" {
  if (submission) {
    return submission.status;
  }

  if (assignment.status === "closed") {
    return "closed";
  }

  if (isDueSoon(assignment.dueAt)) {
    return "due-soon";
  }

  return "published";
}

function daysFromNow(days: number, hour = 10) {
  const next = new Date();
  next.setDate(next.getDate() + days);
  next.setHours(hour, 0, 0, 0);
  return next.toISOString();
}

export const DEFAULT_ASSIGNMENTS: Assignment[] = [
  {
    id: "assignment-ai",
    subjectId: "subject-cs",
    title: "بحث في الذكاء الاصطناعي",
    subject: "علوم الحاسب",
    teacherId: "teacher-1",
    teacherName: "د. سارة خالد القحطاني",
    level: "المستوى السادس",
    dueAt: daysFromNow(2),
    description: "إعداد بحث أكاديمي مختصر عن تطبيقات الذكاء الاصطناعي في التعليم.",
    instructions: "يتضمن البحث مقدمة ومراجع علمية وتحليل نقدي لا يقل عن 1200 كلمة.",
    allowedFormats: ["PDF", "DOCX"],
    maxSubmissions: 2,
    attachments: [
      {
        id: "attachment-ai-rubric",
        fileName: "دليل_التقييم.pdf",
        filePath: null,
        fileMimeType: "application/pdf",
        fileSize: "420 KB",
        uploadedAt: daysFromNow(-4, 9),
      },
    ],
    hasAttachment: true,
    resubmissionPolicy: "replace_latest",
    status: "published",
    createdAt: daysFromNow(-4),
  },
  {
    id: "assignment-db",
    subjectId: "subject-is",
    title: "تقرير قواعد البيانات المتقدمة",
    subject: "نظم المعلومات",
    teacherId: "teacher-1",
    teacherName: "د. سارة خالد القحطاني",
    level: "المستوى السادس",
    dueAt: daysFromNow(5),
    description: "تحليل تصميم قاعدة بيانات لنظام أكاديمي متكامل.",
    instructions: "قدم مخطط الجداول والعلاقات وأسباب اختيار التصميم.",
    allowedFormats: ["PDF", "DOCX"],
    maxSubmissions: 2,
    attachments: [
      {
        id: "attachment-db-template",
        fileName: "قالب_التقرير.docx",
        filePath: null,
        fileMimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: "190 KB",
        uploadedAt: daysFromNow(-3, 11),
      },
    ],
    hasAttachment: true,
    resubmissionPolicy: "replace_latest",
    status: "published",
    createdAt: daysFromNow(-3),
  },
  {
    id: "assignment-network",
    subjectId: "subject-net",
    title: "مشروع تصميم الشبكات",
    subject: "شبكات الحاسب",
    teacherId: "teacher-1",
    teacherName: "د. سارة خالد القحطاني",
    level: "المستوى السادس",
    dueAt: daysFromNow(7),
    description: "تصميم شبكة مؤسسة صغيرة مع توضيح البنية والمنهجية.",
    instructions: "يجب تضمين الرسم التخطيطي والسياسات الأمنية الأساسية.",
    allowedFormats: ["PDF", "PPTX"],
    maxSubmissions: 1,
    attachments: [],
    hasAttachment: false,
    resubmissionPolicy: "replace_latest",
    status: "draft",
    createdAt: daysFromNow(-1),
  },
  {
    id: "assignment-security",
    subjectId: "subject-sec",
    title: "بحث أمن المعلومات",
    subject: "أمن المعلومات",
    teacherId: "teacher-1",
    teacherName: "د. سارة خالد القحطاني",
    level: "المستوى السادس",
    dueAt: daysFromNow(-7),
    description: "بحث حول إدارة المخاطر الأمنية داخل الجامعات.",
    instructions: "استخدم ثلاثة مراجع على الأقل وقدم توصيات عملية.",
    allowedFormats: ["PDF", "DOCX"],
    maxSubmissions: 1,
    attachments: [
      {
        id: "attachment-security-guide",
        fileName: "إرشادات_البحث.pdf",
        filePath: null,
        fileMimeType: "application/pdf",
        fileSize: "260 KB",
        uploadedAt: daysFromNow(-20, 8),
      },
    ],
    hasAttachment: true,
    resubmissionPolicy: "replace_latest",
    status: "closed",
    createdAt: daysFromNow(-20),
  },
];

export const DEFAULT_SUBJECTS: AcademicSubject[] = ACADEMIC_SUBJECT_SEEDS.map((subject) => ({
  id: `subject-${subject.code.toLowerCase()}`,
  nameAr: subject.nameAr,
  nameEn: subject.nameEn,
  code: subject.code,
  department: subject.department,
  level: subject.level,
  semester: subject.semester,
  status: "active",
}));

export const DEFAULT_TEACHER_SUBJECT_MAPPINGS: TeacherSubjectMapping[] = DEFAULT_SUBJECTS.map((subject) => ({
  id: `mapping-teacher-1-${subject.id}`,
  teacherId: "teacher-1",
  subjectId: subject.id,
  department: subject.department,
  level: subject.level,
  semester: subject.semester,
}));

export const DEFAULT_STUDENT_SUBJECT_MAPPINGS: StudentSubjectMapping[] = DEFAULT_SUBJECTS.map((subject) => ({
  id: `mapping-student-1-${subject.id}`,
  studentId: "student-1",
  subjectId: subject.id,
  createdAt: daysFromNow(-14, 8),
}));

export const DEFAULT_SUBMISSIONS: Submission[] = [
  {
    id: "submission-1",
    assignmentId: "assignment-ai",
    studentId: "student-1",
    studentName: "أحمد محمد العتيبي",
    academicId: "202312345",
    fileName: "بحث_الذكاء_الاصطناعي.pdf",
    filePath: null,
    fileMimeType: "application/pdf",
    fileSize: "2.4 MB",
    notes: "أرفقت النسخة النهائية مع المراجع.",
    submittedAt: daysFromNow(-1, 9),
    originality: 87,
    status: "review",
    grade: null,
    feedback: "",
    semester: "الفصل الثاني 1447",
    analysisStatus: "completed",
    analysisRequestedAt: daysFromNow(-1, 9),
    analysisCompletedAt: daysFromNow(-1, 9),
    analysisError: "",
    latestOriginalityCheckId: "check-submission-1",
    events: createSubmissionEvents(daysFromNow(-1, 9), "review"),
  },
  {
    id: "submission-2",
    assignmentId: "assignment-security",
    studentId: "student-1",
    studentName: "أحمد محمد العتيبي",
    academicId: "202312345",
    fileName: "بحث_أمن_المعلومات.pdf",
    filePath: null,
    fileMimeType: "application/pdf",
    fileSize: "1.8 MB",
    notes: "تم تسليم النسخة النهائية.",
    submittedAt: daysFromNow(-10, 11),
    originality: 92,
    status: "graded",
    grade: 92,
    feedback: "عمل ممتاز، التوثيق جيد والتحليل مترابط.",
    semester: "الفصل الثاني 1447",
    analysisStatus: "completed",
    analysisRequestedAt: daysFromNow(-10, 11),
    analysisCompletedAt: daysFromNow(-9, 10),
    analysisError: "",
    latestOriginalityCheckId: "check-submission-2",
    events: createSubmissionEvents(
      daysFromNow(-10, 11),
      "graded",
      daysFromNow(-9, 10),
      daysFromNow(-8, 12),
    ),
  },
  {
    id: "submission-3",
    assignmentId: "assignment-ai",
    studentId: "student-2",
    studentName: "سارة خالد",
    academicId: "202312346",
    fileName: "AI_Research_Sarah.pdf",
    filePath: null,
    fileMimeType: "application/pdf",
    fileSize: "2.1 MB",
    notes: "",
    submittedAt: daysFromNow(-2, 14),
    originality: 94,
    status: "accepted",
    grade: 95,
    feedback: "عرض جيد جداً وتنظيم ممتاز.",
    semester: "الفصل الثاني 1447",
    analysisStatus: "completed",
    analysisRequestedAt: daysFromNow(-2, 14),
    analysisCompletedAt: daysFromNow(-1, 9),
    analysisError: "",
    latestOriginalityCheckId: "check-submission-3",
    events: createSubmissionEvents(
      daysFromNow(-2, 14),
      "accepted",
      daysFromNow(-1, 9),
      daysFromNow(-1, 11),
    ),
  },
  {
    id: "submission-4",
    assignmentId: "assignment-db",
    studentId: "student-3",
    studentName: "عمر علي",
    academicId: "202312347",
    fileName: "DB_Report_Omar.docx",
    filePath: null,
    fileMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileSize: "1.2 MB",
    notes: "",
    submittedAt: daysFromNow(-2, 13),
    originality: 45,
    status: "flagged",
    grade: null,
    feedback: "التشابه مرتفع ويحتاج مراجعة.",
    semester: "الفصل الثاني 1447",
    analysisStatus: "completed",
    analysisRequestedAt: daysFromNow(-2, 13),
    analysisCompletedAt: daysFromNow(-1, 10),
    analysisError: "",
    latestOriginalityCheckId: "check-submission-4",
    events: createSubmissionEvents(
      daysFromNow(-2, 13),
      "flagged",
      daysFromNow(-1, 10),
      daysFromNow(-1, 10),
    ),
  },
];

function deriveReviewDecisionFromSubmissionStatus(
  status: SubmissionStatus,
): ReviewFinalDecision | null {
  if (status === "accepted") {
    return "accepted";
  }

  if (status === "rejected") {
    return "rejected";
  }

  if (status === "revision") {
    return "revision";
  }

  return null;
}

export function deriveReviewsFromSubmissions(
  submissions: Submission[],
  assignments: Assignment[],
): Review[] {
  const assignmentTeacherMap = new Map(assignments.map((assignment) => [assignment.id, assignment.teacherId]));

  return submissions.flatMap((submission) => {
    const teacherId = assignmentTeacherMap.get(submission.assignmentId);
    const hasReviewSignals =
      submission.grade !== null
      || Boolean(submission.feedback)
      || submission.status === "accepted"
      || submission.status === "rejected"
      || submission.status === "revision"
      || submission.status === "graded"
      || submission.status === "flagged";

    if (!teacherId || !hasReviewSignals) {
      return [];
    }

    const reviewedAt = submission.analysisCompletedAt ?? submission.submittedAt;

    return [
      {
        id: `review-${submission.id}`,
        submissionId: submission.id,
        teacherId,
        comments: submission.feedback,
        finalDecision: deriveReviewDecisionFromSubmissionStatus(submission.status),
        reviewedAt,
        manualEvaluation: {
          grade: submission.grade,
          submissionStatus: submission.status,
          originality: submission.originality,
          analysisStatus: submission.analysisStatus,
        },
        appealStatus: "none",
        createdAt: reviewedAt,
        updatedAt: reviewedAt,
      },
    ];
  });
}

export const DEFAULT_REVIEWS = deriveReviewsFromSubmissions(DEFAULT_SUBMISSIONS, DEFAULT_ASSIGNMENTS);

function buildDerivedOriginalityCheck(submission: Submission): OriginalityCheck {
  const fallbackId = `check-${submission.id}`;
  const matchingPercentage = Math.max(0, 100 - submission.originality);
  const riskLevel =
    submission.originality < 50 ? "high" : submission.originality < 80 ? "medium" : "low";

  if (submission.analysisStatus === "manual_review_required") {
    return {
      id: fallbackId,
      submissionId: submission.id,
      originalityScore: 0,
      matchingPercentage: 0,
      riskLevel: "medium",
      recommendedStatus: "review",
      summaryForTeacher: "تعذر استخراج النص آلياً من الملف، لذا تم تحويل الحالة إلى مراجعة يدوية.",
      summaryForStudent: "تعذر تحليل الملف آلياً وتم تحويله إلى مراجعة يدوية لدى المعلم.",
      summaryForAdmin: "الحالة تتطلب متابعة يدوية بسبب تعذر استخراج النص.",
      confidenceScore: 0,
      reasoningNotes: ["manual_review_required"],
      suspiciousSections: [],
      analysisStatus: submission.analysisStatus,
      modelName: "local-demo",
      promptVersion: "demo-v1",
      analyzedAt: submission.analysisCompletedAt,
      createdAt: submission.analysisRequestedAt ?? submission.submittedAt,
      updatedAt: submission.analysisCompletedAt ?? submission.submittedAt,
    };
  }

  if (submission.analysisStatus === "failed") {
    return {
      id: fallbackId,
      submissionId: submission.id,
      originalityScore: submission.originality,
      matchingPercentage,
      riskLevel: "medium",
      recommendedStatus: "review",
      summaryForTeacher: "لم يكتمل التحليل الآلي لهذه النسخة، ويوصى بالمراجعة اليدوية قبل الاعتماد.",
      summaryForStudent: "لم يكتمل تحليل الأصالة لهذه النسخة وسيتم استكمال المراجعة من قبل المعلم.",
      summaryForAdmin: "يوجد فشل في التحليل الآلي لهذه الحالة ويتطلب متابعة.",
      confidenceScore: 0,
      reasoningNotes: ["analysis_failed"],
      suspiciousSections: [],
      analysisStatus: submission.analysisStatus,
      modelName: "local-demo",
      promptVersion: "demo-v1",
      analyzedAt: submission.analysisCompletedAt,
      createdAt: submission.analysisRequestedAt ?? submission.submittedAt,
      updatedAt: submission.analysisCompletedAt ?? submission.submittedAt,
    };
  }

  return {
    id: fallbackId,
    submissionId: submission.id,
    originalityScore: submission.originality,
    matchingPercentage,
    riskLevel,
    recommendedStatus: riskLevel === "high" ? "flagged" : riskLevel === "medium" ? "review" : "clean",
    summaryForTeacher:
      riskLevel === "high"
        ? "تم رصد تشابه مرتفع في أجزاء متعددة من التسليم ويوصى بالمراجعة التفصيلية."
        : riskLevel === "medium"
          ? "يوجد تشابه متوسط في بعض الأجزاء ويستحسن التحقق منها قبل اتخاذ القرار."
          : "لا توجد مؤشرات مرتفعة الخطورة في هذه النسخة وفق التحليل الحالي.",
    summaryForStudent:
      riskLevel === "high"
        ? "تم رصد مستوى تشابه مرتفع نسبياً وسيقوم المعلم بمراجعة الحالة قبل اعتماد النتيجة."
        : riskLevel === "medium"
          ? "يوجد تشابه متوسط في بعض الأجزاء وقد يطلب المعلم توضيحاً أو تعديلاً."
          : "تشير النتيجة الحالية إلى أصالة جيدة مع تشابه محدود غير مؤثر.",
    summaryForAdmin:
      riskLevel === "high"
        ? "الحالة مصنفة عالية الخطورة وتستحق المتابعة ضمن القضايا المؤسسية."
        : riskLevel === "medium"
          ? "الحالة متوسطة الخطورة وتحتاج متابعة ضمن نطاق المادة."
          : "الحالة منخفضة الخطورة ولا تتطلب تصعيداً مؤسسياً.",
    confidenceScore: riskLevel === "low" ? 86 : riskLevel === "medium" ? 74 : 92,
    reasoningNotes:
      riskLevel === "high"
        ? ["high_internal_similarity", "teacher_review_recommended"]
        : riskLevel === "medium"
          ? ["moderate_internal_similarity"]
          : ["low_internal_similarity"],
    suspiciousSections: [],
    analysisStatus: submission.analysisStatus,
    modelName: "local-demo",
    promptVersion: "demo-v1",
    analyzedAt: submission.analysisCompletedAt,
    createdAt: submission.analysisRequestedAt ?? submission.submittedAt,
    updatedAt: submission.analysisCompletedAt ?? submission.submittedAt,
  };
}

export function deriveOriginalityChecksFromSubmissions(submissions: Submission[]): OriginalityCheck[] {
  return submissions
    .filter((submission) => submission.analysisStatus !== "pending" && submission.analysisStatus !== "processing")
    .map((submission) => buildDerivedOriginalityCheck(submission));
}

const submissionById = new Map(DEFAULT_SUBMISSIONS.map((submission) => [submission.id, submission]));

export const DEFAULT_ORIGINALITY_CHECKS: OriginalityCheck[] = [
  {
    id: "check-submission-1",
    submissionId: "submission-1",
    originalityScore: 87,
    matchingPercentage: 13,
    riskLevel: "low",
    recommendedStatus: "clean",
    summaryForTeacher: "النسخة الحالية تبدو أصلية بدرجة جيدة. يوجد تقاطع محدود مع تسليم آخر في نفس التكليف لكنه يقع ضمن التشابه الأكاديمي المتوقع.",
    summaryForStudent: "تشير النتيجة الحالية إلى أصالة جيدة مع تشابه محدود غير مؤثر في التقييم الأولي.",
    summaryForAdmin: "الحالة منخفضة الخطورة ولا تحتاج تصعيداً مؤسسياً.",
    confidenceScore: 88,
    reasoningNotes: ["same_assignment_match_detected", "low_risk_final_recommendation"],
    suspiciousSections: [
      {
        sectionText: "يتطلب توظيف الذكاء الاصطناعي في التعليم الجمع بين التحليل التنبئي والتخصيص المستمر للمحتوى.",
        matchType: "common_overlap",
        matchedReferenceId: "match-submission-1-1",
        reason: "يوجد تقارب في الصياغة العامة، لكنه لا يتجاوز التشابه المتوقع في الموضوعات التعريفية.",
        similarityScore: 38,
      },
    ],
    analysisStatus: "completed",
    modelName: "gemini-2.5-flash",
    promptVersion: "originality-v1",
    analyzedAt: submissionById.get("submission-1")?.analysisCompletedAt ?? null,
    createdAt: submissionById.get("submission-1")?.analysisRequestedAt ?? submissionById.get("submission-1")?.submittedAt ?? new Date().toISOString(),
    updatedAt: submissionById.get("submission-1")?.analysisCompletedAt ?? submissionById.get("submission-1")?.submittedAt ?? new Date().toISOString(),
  },
  {
    id: "check-submission-2",
    submissionId: "submission-2",
    originalityScore: 92,
    matchingPercentage: 8,
    riskLevel: "low",
    recommendedStatus: "clean",
    summaryForTeacher: "لا توجد مؤشرات جوهرية على تشابه مقلق في هذه النسخة. التوافقات المرصودة منخفضة ومحصورة في عبارات أكاديمية عامة.",
    summaryForStudent: "أصالة مرتفعة مع تشابه محدود جداً.",
    summaryForAdmin: "الحالة سليمة ولا تحتاج متابعة إضافية.",
    confidenceScore: 91,
    reasoningNotes: ["minimal_overlap", "clean_recommendation"],
    suspiciousSections: [],
    analysisStatus: "completed",
    modelName: "gemini-2.5-flash",
    promptVersion: "originality-v1",
    analyzedAt: submissionById.get("submission-2")?.analysisCompletedAt ?? null,
    createdAt: submissionById.get("submission-2")?.analysisRequestedAt ?? submissionById.get("submission-2")?.submittedAt ?? new Date().toISOString(),
    updatedAt: submissionById.get("submission-2")?.analysisCompletedAt ?? submissionById.get("submission-2")?.submittedAt ?? new Date().toISOString(),
  },
  {
    id: "check-submission-3",
    submissionId: "submission-3",
    originalityScore: 94,
    matchingPercentage: 6,
    riskLevel: "low",
    recommendedStatus: "clean",
    summaryForTeacher: "النسخة أصلية بدرجة عالية ولا تحتوي إلا على تقاطعات طفيفة غير مثيرة للقلق.",
    summaryForStudent: "أصالة مرتفعة جداً وفق التحليل الحالي.",
    summaryForAdmin: "لا توجد مؤشرات اشتباه مؤسسية في هذه الحالة.",
    confidenceScore: 90,
    reasoningNotes: ["high_originality_score"],
    suspiciousSections: [],
    analysisStatus: "completed",
    modelName: "gemini-2.5-flash",
    promptVersion: "originality-v1",
    analyzedAt: submissionById.get("submission-3")?.analysisCompletedAt ?? null,
    createdAt: submissionById.get("submission-3")?.analysisRequestedAt ?? submissionById.get("submission-3")?.submittedAt ?? new Date().toISOString(),
    updatedAt: submissionById.get("submission-3")?.analysisCompletedAt ?? submissionById.get("submission-3")?.submittedAt ?? new Date().toISOString(),
  },
  {
    id: "check-submission-4",
    submissionId: "submission-4",
    originalityScore: 45,
    matchingPercentage: 55,
    riskLevel: "high",
    recommendedStatus: "flagged",
    summaryForTeacher: "تم رصد تشابه مرتفع في أكثر من مقطع مع تسليمات داخلية، وبعض المواضع تبدو أقرب إلى إعادة الصياغة مع المحافظة على نفس التسلسل الفكري.",
    summaryForStudent: "تم رصد مستوى تشابه مرتفع نسبياً وسيقوم المعلم بمراجعة الحالة بالتفصيل قبل اعتماد النتيجة.",
    summaryForAdmin: "الحالة عالية الخطورة وتستحق المتابعة ضمن قضايا الأصالة المؤسسية.",
    confidenceScore: 93,
    reasoningNotes: ["high_similarity_detected", "multiple_internal_matches", "flagged_for_review"],
    suspiciousSections: [
      {
        sectionText: "يؤدي تصميم قاعدة البيانات المتقدمة إلى تحسين سلامة البيانات وقابلية التوسع عند استخدام الفهارس والعلاقات المرجعية بشكل صحيح.",
        matchType: "literal",
        matchedReferenceId: "match-submission-4-1",
        reason: "التطابق النصي مرتفع مع تشابه واضح في نفس البنية وتسلسل الأفكار.",
        similarityScore: 89,
      },
      {
        sectionText: "يعتمد النموذج المقترح على تقسيم الجداول بطريقة تقلل التكرار وتحافظ على التكامل المرجعي.",
        matchType: "paraphrased",
        matchedReferenceId: "match-submission-4-2",
        reason: "إعادة صياغة قريبة جداً من مرجع داخلي مع الحفاظ على المفاهيم والترتيب نفسه.",
        similarityScore: 74,
      },
    ],
    analysisStatus: "completed",
    modelName: "gemini-2.5-flash",
    promptVersion: "originality-v1",
    analyzedAt: submissionById.get("submission-4")?.analysisCompletedAt ?? null,
    createdAt: submissionById.get("submission-4")?.analysisRequestedAt ?? submissionById.get("submission-4")?.submittedAt ?? new Date().toISOString(),
    updatedAt: submissionById.get("submission-4")?.analysisCompletedAt ?? submissionById.get("submission-4")?.submittedAt ?? new Date().toISOString(),
  },
];

export const DEFAULT_SUBMISSION_MATCHES: SubmissionMatch[] = [
  {
    id: "match-submission-1-1",
    originalityCheckId: "check-submission-1",
    submissionId: "submission-1",
    matchedSubmissionId: "submission-3",
    matchedStudentId: "student-2",
    matchedStudentName: "سارة خالد",
    matchedAssignmentId: "assignment-ai",
    matchedSubjectId: null,
    similarityScore: 38,
    matchType: "common_overlap",
    matchedExcerpt: "توظيف الذكاء الاصطناعي في التعليم يحتاج إلى تحليل للبيانات وتخصيص المحتوى وفق أداء الطالب.",
    sectionText: "يتطلب توظيف الذكاء الاصطناعي في التعليم الجمع بين التحليل التنبئي والتخصيص المستمر للمحتوى.",
    sourceScope: "same_assignment",
    rankOrder: 1,
    createdAt: submissionById.get("submission-1")?.analysisCompletedAt ?? submissionById.get("submission-1")?.submittedAt ?? new Date().toISOString(),
  },
  {
    id: "match-submission-4-1",
    originalityCheckId: "check-submission-4",
    submissionId: "submission-4",
    matchedSubmissionId: "submission-2",
    matchedStudentId: "student-1",
    matchedStudentName: "أحمد محمد العتيبي",
    matchedAssignmentId: "assignment-security",
    matchedSubjectId: null,
    similarityScore: 89,
    matchType: "literal",
    matchedExcerpt: "يسهم تصميم قاعدة البيانات المتقدمة في رفع سلامة البيانات وتحسين القابلية للتوسع عند استخدام الفهارس والعلاقات المرجعية.",
    sectionText: "يؤدي تصميم قاعدة البيانات المتقدمة إلى تحسين سلامة البيانات وقابلية التوسع عند استخدام الفهارس والعلاقات المرجعية بشكل صحيح.",
    sourceScope: "same_level_semester",
    rankOrder: 1,
    createdAt: submissionById.get("submission-4")?.analysisCompletedAt ?? submissionById.get("submission-4")?.submittedAt ?? new Date().toISOString(),
  },
  {
    id: "match-submission-4-2",
    originalityCheckId: "check-submission-4",
    submissionId: "submission-4",
    matchedSubmissionId: "submission-1",
    matchedStudentId: "student-1",
    matchedStudentName: "أحمد محمد العتيبي",
    matchedAssignmentId: "assignment-ai",
    matchedSubjectId: null,
    similarityScore: 74,
    matchType: "paraphrased",
    matchedExcerpt: "يعتمد التصور المقترح على تقليل التكرار بين الجداول والحفاظ على الترابط المرجعي في البنية العامة.",
    sectionText: "يعتمد النموذج المقترح على تقسيم الجداول بطريقة تقلل التكرار وتحافظ على التكامل المرجعي.",
    sourceScope: "same_level_semester",
    rankOrder: 2,
    createdAt: submissionById.get("submission-4")?.analysisCompletedAt ?? submissionById.get("submission-4")?.submittedAt ?? new Date().toISOString(),
  },
];
