import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ACADEMIC_DATA_STORAGE_KEY,
  DEFAULT_SUBJECTS,
  createSubmissionEvents,
  DEFAULT_ASSIGNMENTS,
  DEFAULT_ORIGINALITY_CHECKS,
  DEFAULT_REVIEWS,
  DEFAULT_STUDENT_SUBJECT_MAPPINGS,
  DEFAULT_SUBMISSION_MATCHES,
  DEFAULT_SUBMISSIONS,
  DEFAULT_TEACHER_SUBJECT_MAPPINGS,
  deriveSubjectsFromAssignments,
  deriveStudentSubjectMappings,
  deriveTeacherSubjectMappings,
  deriveOriginalityChecksFromSubmissions,
  deriveReviewsFromSubmissions,
  canStudentAccessAssignmentWithMappings,
  isAnalysisPending,
  type AcademicSubject,
  type Assignment,
  type AssignmentAttachment,
  type AssignmentStatus,
  type OriginalityCheck,
  type Review,
  type ReviewFinalDecision,
  type SubmissionMatch,
  type Submission,
  type StudentSubjectMapping,
  type TeacherSubjectMapping,
  normalizeAssignment,
} from "@/lib/academic-data";
import { buildSystemSettingsActivityItem, type ActivityFeedItem } from "@/lib/activity-feed";
import { useAuth } from "@/contexts/AuthContext";
import {
  createSupabaseAssignment,
  createSupabaseSubject,
  clearSupabaseSubmissionArtifacts,
  deleteSupabaseSubject,
  ensureSupabaseStudentSubjectMapping,
  ensureSupabaseTeacherSubjectMapping,
  isLocalDemoFallbackEnabled,
  isSupabaseConfigured,
  loadSupabaseAcademicData,
  removeSupabaseStudentSubjectMapping,
  removeSupabaseTeacherSubjectMapping,
  requestSupabaseSubmissionAnalysis,
  updateSupabaseSubject,
  updateSupabaseSubmissionReview,
  upsertSupabaseSubmission,
} from "@/lib/supabase-app";
import {
  getSystemSettingsSnapshot,
  SYSTEM_SETTINGS_ACTIVITY_EVENT,
  type SystemSettingsActivityDetail,
} from "@/lib/system-settings";

interface CreateAssignmentInput {
  subjectId: string | null;
  title: string;
  subject: string;
  level: string;
  description: string;
  instructions: string;
  dueAt: string;
  allowedFormats: string[];
  maxSubmissions: number;
  attachments: AssignmentAttachment[];
  resubmissionPolicy: string;
  status: AssignmentStatus;
}

interface SubmitAssignmentInput {
  assignmentId: string;
  fileName: string;
  filePath?: string | null;
  fileMimeType?: string;
  fileSize: string;
  notes: string;
}

interface ReviewSubmissionInput {
  submissionId: string;
  finalDecision: ReviewFinalDecision;
  grade: number | null;
  feedback: string;
}

interface CreateSubjectInput {
  nameAr: string;
  nameEn: string;
  code: string;
  department: string;
  level: string;
  semester: string;
}

interface UpdateSubjectInput extends CreateSubjectInput {
  id: string;
  status: AcademicSubject["status"];
}

interface AssignTeacherSubjectInput {
  teacherId: string;
  subjectId: string;
}

interface RemoveTeacherSubjectMappingInput {
  mappingId: string;
}

interface AssignStudentSubjectInput {
  studentId: string;
  subjectId: string;
}

interface RemoveStudentSubjectMappingInput {
  mappingId: string;
}

interface DeleteSubjectInput {
  subjectId: string;
}

interface DeleteSubjectResult {
  ok: boolean;
  error?: string;
}

type PersistenceMode = "local" | "supabase";

interface AcademicDataContextValue {
  activityFeed: ActivityFeedItem[];
  assignments: Assignment[];
  isRefreshing: boolean;
  originalityChecks: OriginalityCheck[];
  reviews: Review[];
  studentSubjectMappings: StudentSubjectMapping[];
  submissionMatches: SubmissionMatch[];
  submissions: Submission[];
  subjects: AcademicSubject[];
  teacherSubjectMappings: TeacherSubjectMapping[];
  persistenceMode: PersistenceMode;
  createAssignment: (input: CreateAssignmentInput) => Promise<Assignment | null>;
  createSubject: (input: CreateSubjectInput) => Promise<AcademicSubject | null>;
  updateSubject: (input: UpdateSubjectInput) => Promise<AcademicSubject | null>;
  deleteSubject: (input: DeleteSubjectInput) => Promise<DeleteSubjectResult>;
  assignTeacherSubject: (input: AssignTeacherSubjectInput) => Promise<TeacherSubjectMapping | null>;
  removeTeacherSubjectMapping: (input: RemoveTeacherSubjectMappingInput) => Promise<boolean>;
  assignStudentSubject: (input: AssignStudentSubjectInput) => Promise<StudentSubjectMapping | null>;
  removeStudentSubjectMapping: (input: RemoveStudentSubjectMappingInput) => Promise<boolean>;
  refreshAcademicData: () => Promise<void>;
  startSubmissionAnalysis: (
    submissionId: string,
  ) => Promise<{ submission: Submission | null; error: string | null }>;
  submitAssignment: (input: SubmitAssignmentInput) => Promise<Submission | null>;
  reviewSubmission: (input: ReviewSubmissionInput) => Promise<Submission | null>;
  getAssignmentById: (assignmentId: string) => Assignment | undefined;
  getLatestOriginalityCheckBySubmissionId: (submissionId: string) => OriginalityCheck | undefined;
  getReviewBySubmissionId: (submissionId: string) => Review | undefined;
  getSubjectById: (subjectId: string) => AcademicSubject | undefined;
  getSubmissionMatches: (submissionId: string) => SubmissionMatch[];
  getSubmissionById: (submissionId: string) => Submission | undefined;
  getStudentAssignments: (studentId: string) => Assignment[];
  getStudentSubmission: (studentId: string, assignmentId: string) => Submission | undefined;
  getStudentSubmissions: (studentId: string) => Submission[];
  getTeacherAssignments: (teacherId: string) => Assignment[];
  getTeacherSubjects: (teacherId: string) => AcademicSubject[];
  getTeacherSubmissions: (teacherId: string) => Submission[];
}

const AcademicDataContext = createContext<AcademicDataContextValue | null>(null);

interface StoredAcademicData {
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

function getDefaultAcademicData(): StoredAcademicData {
  return {
    activityFeed: [],
    assignments: DEFAULT_ASSIGNMENTS,
    originalityChecks: DEFAULT_ORIGINALITY_CHECKS,
    reviews: DEFAULT_REVIEWS,
    studentSubjectMappings: DEFAULT_STUDENT_SUBJECT_MAPPINGS,
    submissionMatches: DEFAULT_SUBMISSION_MATCHES,
    submissions: DEFAULT_SUBMISSIONS,
    subjects: DEFAULT_SUBJECTS,
    teacherSubjectMappings: DEFAULT_TEACHER_SUBJECT_MAPPINGS,
  };
}

function loadAcademicData(): StoredAcademicData {
  if (typeof window === "undefined") {
    return getDefaultAcademicData();
  }

  const raw = localStorage.getItem(ACADEMIC_DATA_STORAGE_KEY);
  if (!raw) {
    const defaults = getDefaultAcademicData();
    localStorage.setItem(ACADEMIC_DATA_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAcademicData>;
    if (!Array.isArray(parsed.assignments) || !Array.isArray(parsed.submissions)) {
      throw new Error("Invalid academic data");
    }

    return {
      activityFeed: Array.isArray(parsed.activityFeed) ? parsed.activityFeed as ActivityFeedItem[] : [],
      assignments: parsed.assignments.map((assignment) => normalizeAssignment({
        ...assignment,
        attachments: Array.isArray(assignment.attachments) ? assignment.attachments : [],
      })),
      originalityChecks: Array.isArray(parsed.originalityChecks)
        ? parsed.originalityChecks
        : deriveOriginalityChecksFromSubmissions(parsed.submissions),
      reviews: Array.isArray(parsed.reviews)
        ? parsed.reviews
        : deriveReviewsFromSubmissions(parsed.submissions, parsed.assignments),
      studentSubjectMappings: Array.isArray(parsed.studentSubjectMappings)
        ? parsed.studentSubjectMappings as StudentSubjectMapping[]
        : deriveStudentSubjectMappings(parsed.assignments, parsed.submissions),
      submissionMatches: Array.isArray(parsed.submissionMatches) ? parsed.submissionMatches : [],
      submissions: parsed.submissions,
      subjects: Array.isArray(parsed.subjects)
        ? parsed.subjects as AcademicSubject[]
        : deriveSubjectsFromAssignments(parsed.assignments),
      teacherSubjectMappings: Array.isArray(parsed.teacherSubjectMappings)
        ? parsed.teacherSubjectMappings as TeacherSubjectMapping[]
        : deriveTeacherSubjectMappings(
            parsed.assignments,
            Array.isArray(parsed.subjects)
              ? parsed.subjects as AcademicSubject[]
              : deriveSubjectsFromAssignments(parsed.assignments),
          ),
    };
  } catch {
    const defaults = getDefaultAcademicData();
    localStorage.setItem(ACADEMIC_DATA_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
}

function mergeSubmission(current: Submission[], nextSubmission: Submission, existingId?: string) {
  if (existingId) {
    return current.map((submission) => (submission.id === existingId ? nextSubmission : submission));
  }

  return [nextSubmission, ...current];
}

function upsertReview(current: Review[], nextReview: Review) {
  if (current.some((review) => review.submissionId === nextReview.submissionId)) {
    return current.map((review) =>
      review.submissionId === nextReview.submissionId ? nextReview : review,
    );
  }

  return [nextReview, ...current];
}

export function AcademicDataProvider({ children }: { children: ReactNode }) {
  const { authMode, user } = useAuth();
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [originalityChecks, setOriginalityChecks] = useState<OriginalityCheck[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [studentSubjectMappings, setStudentSubjectMappings] = useState<StudentSubjectMapping[]>([]);
  const [submissionMatches, setSubmissionMatches] = useState<SubmissionMatch[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [teacherSubjectMappings, setTeacherSubjectMappings] = useState<TeacherSubjectMapping[]>([]);
  const [persistenceMode, setPersistenceMode] = useState<PersistenceMode>("local");

  const applyRemoteData = useCallback((
    remoteData: Awaited<ReturnType<typeof loadSupabaseAcademicData>>,
  ) => {
    if (!remoteData) {
      return;
    }

    setActivityFeed(remoteData.activityFeed);
    setAssignments(remoteData.assignments);
    setOriginalityChecks(remoteData.originalityChecks);
    setReviews(remoteData.reviews);
    setStudentSubjectMappings(remoteData.studentSubjectMappings);
    setSubmissionMatches(remoteData.submissionMatches);
    setSubmissions(remoteData.submissions);
    setSubjects(remoteData.subjects);
    setTeacherSubjectMappings(remoteData.teacherSubjectMappings);
    setPersistenceMode("supabase");
  }, []);

  const refreshAcademicData = useCallback(async () => {
    if (authMode !== "supabase" || !user || !isSupabaseConfigured()) {
      return;
    }

    setIsRefreshing(true);

    try {
      const remoteData = await loadSupabaseAcademicData();
      applyRemoteData(remoteData);
    } finally {
      setIsRefreshing(false);
    }
  }, [applyRemoteData, authMode, user]);

  useEffect(() => {
    let cancelled = false;
    const localFallbackEnabled = isLocalDemoFallbackEnabled();

    const initialize = async () => {
      if (authMode === "supabase" && user && isSupabaseConfigured()) {
        const remoteData = await loadSupabaseAcademicData();
        if (remoteData && !cancelled) {
          applyRemoteData(remoteData);
          return;
        }

        if (!remoteData && !cancelled && !localFallbackEnabled) {
          setAssignments([]);
          setActivityFeed([]);
          setOriginalityChecks([]);
          setReviews([]);
          setStudentSubjectMappings([]);
          setSubmissionMatches([]);
          setSubmissions([]);
          setSubjects([]);
          setTeacherSubjectMappings([]);
          setPersistenceMode("supabase");
          return;
        }
      }

      const stored = loadAcademicData();
      if (cancelled) {
        return;
      }
      setAssignments(stored.assignments);
      setActivityFeed(stored.activityFeed);
      setOriginalityChecks(stored.originalityChecks);
      setReviews(stored.reviews);
      setStudentSubjectMappings(stored.studentSubjectMappings);
      setSubmissionMatches(stored.submissionMatches);
      setSubmissions(stored.submissions);
      setSubjects(stored.subjects);
      setTeacherSubjectMappings(stored.teacherSubjectMappings);
      setPersistenceMode("local");
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [applyRemoteData, authMode, user]);

  useEffect(() => {
    if (persistenceMode !== "local") {
      return;
    }

    if (
      assignments.length === 0
      && activityFeed.length === 0
      && originalityChecks.length === 0
      && reviews.length === 0
      && studentSubjectMappings.length === 0
      && submissionMatches.length === 0
      && submissions.length === 0
      && subjects.length === 0
      && teacherSubjectMappings.length === 0
    ) {
      return;
    }

    localStorage.setItem(
      ACADEMIC_DATA_STORAGE_KEY,
      JSON.stringify({
        activityFeed,
        assignments,
        originalityChecks,
        reviews,
        studentSubjectMappings,
        submissionMatches,
        submissions,
        subjects,
        teacherSubjectMappings,
      }),
    );
  }, [
    activityFeed,
    assignments,
    originalityChecks,
    persistenceMode,
    reviews,
    studentSubjectMappings,
    submissionMatches,
    submissions,
    subjects,
    teacherSubjectMappings,
  ]);

  const assignmentMap = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.id, assignment])),
    [assignments],
  );
  const subjectMap = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects],
  );
  const originalityCheckMap = useMemo(
    () => new Map(originalityChecks.map((check) => [check.id, check])),
    [originalityChecks],
  );
  const originalityCheckBySubmissionMap = useMemo(
    () => new Map(originalityChecks.map((check) => [check.submissionId, check])),
    [originalityChecks],
  );
  const reviewMap = useMemo(
    () => new Map(reviews.map((review) => [review.submissionId, review])),
    [reviews],
  );
  const teacherSubjectMap = useMemo(
    () =>
      teacherSubjectMappings.reduce((accumulator, mapping) => {
        const current = accumulator.get(mapping.teacherId) ?? [];
        current.push(mapping);
        accumulator.set(mapping.teacherId, current);
        return accumulator;
      }, new Map<string, TeacherSubjectMapping[]>()),
    [teacherSubjectMappings],
  );
  const hasPendingAnalyses = useMemo(
    () =>
      submissions.some(
        (submission) =>
          isAnalysisPending(submission.analysisStatus) && Boolean(submission.analysisRequestedAt),
      ),
    [submissions],
  );

  useEffect(() => {
    if (authMode !== "supabase" || !user || !isSupabaseConfigured() || !hasPendingAnalyses) {
      return;
    }

    let cancelled = false;

    const syncPendingAnalyses = async () => {
      const remoteData = await loadSupabaseAcademicData();
      if (cancelled || !remoteData) {
        return;
      }

      applyRemoteData(remoteData);
    };

    void syncPendingAnalyses();

    const intervalId = window.setInterval(() => {
      void syncPendingAnalyses();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyRemoteData, authMode, hasPendingAnalyses, user]);

  useEffect(() => {
    if (
      typeof window === "undefined"
      || typeof document === "undefined"
      || authMode !== "supabase"
      || !user
      || !isSupabaseConfigured()
    ) {
      return;
    }

    let cancelled = false;

    const syncLiveData = async () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      const remoteData = await loadSupabaseAcademicData();
      if (cancelled || !remoteData) {
        return;
      }

      applyRemoteData(remoteData);
    };

    const handleFocus = () => {
      void syncLiveData();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncLiveData();
      }
    };

    const intervalId = window.setInterval(() => {
      void syncLiveData();
    }, 30000);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applyRemoteData, authMode, user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleSettingsActivity = (event: Event) => {
      const detail = (event as CustomEvent<SystemSettingsActivityDetail>).detail;
      if (!detail) {
        return;
      }

      if (detail.storageMode === "supabase" && authMode === "supabase" && isSupabaseConfigured()) {
        void refreshAcademicData();
        return;
      }

      const nextItem = buildSystemSettingsActivityItem(detail);
      setActivityFeed((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== nextItem.id);
        return [nextItem, ...withoutDuplicate].sort(
          (left, right) => +new Date(right.occurredAt) - +new Date(left.occurredAt),
        );
      });
    };

    window.addEventListener(SYSTEM_SETTINGS_ACTIVITY_EVENT, handleSettingsActivity as EventListener);

    return () => {
      window.removeEventListener(
        SYSTEM_SETTINGS_ACTIVITY_EVENT,
        handleSettingsActivity as EventListener,
      );
    };
  }, [authMode, refreshAcademicData]);

  const createAssignment = async (input: CreateAssignmentInput) => {
    if (!user) {
      return null;
    }

    const localFallbackEnabled = isLocalDemoFallbackEnabled();
    const nextAssignment: Assignment = {
      id: `assignment-${Date.now()}`,
      subjectId: input.subjectId,
      title: input.title,
      subject: input.subject,
      teacherId: user.id,
      teacherName: user.fullName,
      level: input.level,
      dueAt: input.dueAt,
      description: input.description,
      instructions: input.instructions,
      allowedFormats: input.allowedFormats,
      maxSubmissions: input.maxSubmissions,
      attachments: input.attachments,
      hasAttachment: input.attachments.length > 0,
      resubmissionPolicy: input.resubmissionPolicy,
      status: input.status,
      createdAt: new Date().toISOString(),
    };

    if (authMode === "supabase" && isSupabaseConfigured()) {
      const remoteAssignment = await createSupabaseAssignment({
        subjectId: nextAssignment.subjectId,
        title: nextAssignment.title,
        subject: nextAssignment.subject,
        teacherId: nextAssignment.teacherId,
        teacherName: nextAssignment.teacherName,
        level: nextAssignment.level,
        dueAt: nextAssignment.dueAt,
        description: nextAssignment.description,
        instructions: nextAssignment.instructions,
        allowedFormats: nextAssignment.allowedFormats,
        maxSubmissions: nextAssignment.maxSubmissions,
        attachments: nextAssignment.attachments,
        hasAttachment: nextAssignment.hasAttachment,
        resubmissionPolicy: nextAssignment.resubmissionPolicy,
        status: nextAssignment.status,
        createdAt: nextAssignment.createdAt,
      });

      if (remoteAssignment) {
        const normalizedRemoteAssignment = normalizeAssignment(remoteAssignment);
        const linkedSubject = normalizedRemoteAssignment.subjectId
          ? subjectMap.get(normalizedRemoteAssignment.subjectId)
          : undefined;
        const existingMapping = linkedSubject
          ? (teacherSubjectMap.get(user.id) ?? []).some(
              (mapping) => mapping.subjectId === linkedSubject.id,
            )
          : false;

        if (linkedSubject && !existingMapping) {
          const createdMapping = await ensureSupabaseTeacherSubjectMapping({
            teacherId: user.id,
            subject: linkedSubject,
          });

          if (createdMapping) {
            setTeacherSubjectMappings((current) => {
              if (current.some((mapping) => mapping.id === createdMapping.id)) {
                return current;
              }

              return [...current, createdMapping];
            });
          }
        }

        setAssignments((current) => [normalizedRemoteAssignment, ...current]);
        setPersistenceMode("supabase");
        return normalizedRemoteAssignment;
      }

      if (!localFallbackEnabled) {
        return null;
      }
    }

    const normalizedLocalAssignment = normalizeAssignment(nextAssignment);
    if (normalizedLocalAssignment.subjectId) {
      const linkedSubject = subjectMap.get(normalizedLocalAssignment.subjectId);
      const existingMapping = (teacherSubjectMap.get(user.id) ?? [])
        .some((mapping) => mapping.subjectId === normalizedLocalAssignment.subjectId);

      if (linkedSubject && !existingMapping) {
        setTeacherSubjectMappings((current) => [
          ...current,
          {
            id: `mapping-${user.id}-${linkedSubject.id}`,
            teacherId: user.id,
            subjectId: linkedSubject.id,
            department: linkedSubject.department,
            level: linkedSubject.level,
            semester: linkedSubject.semester,
          },
        ]);
      }
    }

    setAssignments((current) => [normalizedLocalAssignment, ...current]);
    setPersistenceMode("local");
    return normalizedLocalAssignment;
  };

  const createSubject = async (input: CreateSubjectInput) => {
    const localFallbackEnabled = isLocalDemoFallbackEnabled();
    const nextSubject: AcademicSubject = {
      id: globalThis.crypto?.randomUUID?.() ?? `subject-${Date.now()}`,
      nameAr: input.nameAr.trim(),
      nameEn: input.nameEn.trim(),
      code: input.code.trim(),
      department: input.department.trim(),
      level: input.level.trim(),
      semester: input.semester.trim(),
      status: "active",
    };

    if (authMode === "supabase" && isSupabaseConfigured()) {
      const remoteSubject = await createSupabaseSubject(nextSubject);
      if (remoteSubject) {
        setSubjects((current) => [remoteSubject, ...current].sort((left, right) =>
          left.nameAr.localeCompare(right.nameAr, "ar")));
        setPersistenceMode("supabase");
        return remoteSubject;
      }

      if (!localFallbackEnabled) {
        return null;
      }
    }

    setSubjects((current) => [nextSubject, ...current].sort((left, right) =>
      left.nameAr.localeCompare(right.nameAr, "ar")));
    setPersistenceMode("local");
    return nextSubject;
  };

  const updateSubject = async (input: UpdateSubjectInput) => {
    const localFallbackEnabled = isLocalDemoFallbackEnabled();
    const currentSubject = subjectMap.get(input.id);

    if (!currentSubject) {
      return null;
    }

    const nextSubject: AcademicSubject = {
      ...currentSubject,
      nameAr: input.nameAr.trim(),
      nameEn: input.nameEn.trim(),
      code: input.code.trim(),
      department: input.department.trim(),
      level: input.level.trim(),
      semester: input.semester.trim(),
      status: input.status,
    };

    if (authMode === "supabase" && isSupabaseConfigured()) {
      const remoteSubject = await updateSupabaseSubject(nextSubject);
      if (remoteSubject) {
        setSubjects((current) =>
          current
            .map((subject) => (subject.id === remoteSubject.id ? remoteSubject : subject))
            .sort((left, right) => left.nameAr.localeCompare(right.nameAr, "ar")));
        setAssignments((current) =>
          current.map((assignment) =>
            assignment.subjectId === remoteSubject.id
              ? {
                  ...assignment,
                  subject: remoteSubject.nameAr,
                  level: remoteSubject.level,
                }
              : assignment
          ));
        setTeacherSubjectMappings((current) =>
          current.map((mapping) =>
            mapping.subjectId === remoteSubject.id
              ? {
                  ...mapping,
                  department: remoteSubject.department,
                  level: remoteSubject.level,
                  semester: remoteSubject.semester,
                }
              : mapping
          ));
        setPersistenceMode("supabase");
        return remoteSubject;
      }

      if (!localFallbackEnabled) {
        return null;
      }
    }

    setSubjects((current) =>
      current
        .map((subject) => (subject.id === nextSubject.id ? nextSubject : subject))
        .sort((left, right) => left.nameAr.localeCompare(right.nameAr, "ar")));
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.subjectId === nextSubject.id
          ? {
              ...assignment,
              subject: nextSubject.nameAr,
              level: nextSubject.level,
            }
          : assignment
      ));
    setTeacherSubjectMappings((current) =>
      current.map((mapping) =>
        mapping.subjectId === nextSubject.id
          ? {
              ...mapping,
              department: nextSubject.department,
              level: nextSubject.level,
              semester: nextSubject.semester,
            }
          : mapping
      ));
    setPersistenceMode("local");
    return nextSubject;
  };

  const deleteSubjectHandler = async (input: DeleteSubjectInput): Promise<DeleteSubjectResult> => {
    const currentSubject = subjectMap.get(input.subjectId);

    if (!currentSubject) {
      return {
        ok: false,
        error: "تعذر العثور على المادة المطلوبة.",
      };
    }

    if (assignments.some((assignment) => assignment.subjectId === input.subjectId)) {
      return {
        ok: false,
        error: "لا يمكن حذف المادة لوجود تكليفات مرتبطة بها. قم بأرشفتها بدلًا من حذفها.",
      };
    }

    if (teacherSubjectMappings.some((mapping) => mapping.subjectId === input.subjectId)) {
      return {
        ok: false,
        error: "لا يمكن حذف المادة لوجود معلمين مرتبطين بها. قم بفك الارتباطات أولًا.",
      };
    }

    if (studentSubjectMappings.some((mapping) => mapping.subjectId === input.subjectId)) {
      return {
        ok: false,
        error: "لا يمكن حذف المادة لوجود طلاب مرتبطين بها. قم بفك ارتباطات الطلاب أولًا.",
      };
    }

    const localFallbackEnabled = isLocalDemoFallbackEnabled();

    if (authMode === "supabase" && isSupabaseConfigured()) {
      const remoteResult = await deleteSupabaseSubject(input.subjectId);
      if (remoteResult.ok) {
        setSubjects((current) => current.filter((subject) => subject.id !== input.subjectId));
        setPersistenceMode("supabase");
        return { ok: true };
      }

      if (!localFallbackEnabled) {
        return remoteResult;
      }
    }

    setSubjects((current) => current.filter((subject) => subject.id !== input.subjectId));
    setPersistenceMode("local");
    return { ok: true };
  };

  const assignTeacherSubject = async (input: AssignTeacherSubjectInput) => {
    const localFallbackEnabled = isLocalDemoFallbackEnabled();
    const linkedSubject = subjectMap.get(input.subjectId);

    if (!linkedSubject) {
      return null;
    }

    const existingMapping = teacherSubjectMappings.find(
      (mapping) =>
        mapping.teacherId === input.teacherId
        && mapping.subjectId === input.subjectId,
    );

    if (existingMapping) {
      return existingMapping;
    }

    if (authMode === "supabase" && isSupabaseConfigured()) {
      const remoteMapping = await ensureSupabaseTeacherSubjectMapping({
        teacherId: input.teacherId,
        subject: linkedSubject,
      });

      if (remoteMapping) {
        setTeacherSubjectMappings((current) => [...current, remoteMapping]);
        setPersistenceMode("supabase");
        return remoteMapping;
      }

      if (!localFallbackEnabled) {
        return null;
      }
    }

    const nextMapping: TeacherSubjectMapping = {
      id: globalThis.crypto?.randomUUID?.()
        ?? `mapping-${input.teacherId}-${input.subjectId}`,
      teacherId: input.teacherId,
      subjectId: input.subjectId,
      department: linkedSubject.department,
      level: linkedSubject.level,
      semester: linkedSubject.semester,
    };

    setTeacherSubjectMappings((current) => [...current, nextMapping]);
    setPersistenceMode("local");
    return nextMapping;
  };

  const removeTeacherSubjectMappingHandler = async (input: RemoveTeacherSubjectMappingInput) => {
    const currentMapping = teacherSubjectMappings.find((mapping) => mapping.id === input.mappingId);

    if (!currentMapping) {
      return false;
    }

    const localFallbackEnabled = isLocalDemoFallbackEnabled();

    if (authMode === "supabase" && isSupabaseConfigured()) {
      const removed = await removeSupabaseTeacherSubjectMapping(input.mappingId);
      if (removed) {
        setTeacherSubjectMappings((current) =>
          current.filter((mapping) => mapping.id !== input.mappingId));
        setPersistenceMode("supabase");
        return true;
      }

      if (!localFallbackEnabled) {
        return false;
      }
    }

    setTeacherSubjectMappings((current) =>
      current.filter((mapping) => mapping.id !== input.mappingId));
    setPersistenceMode("local");
    return true;
  };

  const assignStudentSubject = async (input: AssignStudentSubjectInput) => {
    const localFallbackEnabled = isLocalDemoFallbackEnabled();
    const linkedSubject = subjectMap.get(input.subjectId);

    if (!linkedSubject) {
      return null;
    }

    const existingMapping = studentSubjectMappings.find(
      (mapping) =>
        mapping.studentId === input.studentId
        && mapping.subjectId === input.subjectId,
    );

    if (existingMapping) {
      return existingMapping;
    }

    if (authMode === "supabase" && isSupabaseConfigured()) {
      const remoteMapping = await ensureSupabaseStudentSubjectMapping({
        studentId: input.studentId,
        subjectId: input.subjectId,
      });

      if (remoteMapping) {
        setStudentSubjectMappings((current) => [...current, remoteMapping]);
        setPersistenceMode("supabase");
        return remoteMapping;
      }

      if (!localFallbackEnabled) {
        return null;
      }
    }

    const nextMapping: StudentSubjectMapping = {
      id: globalThis.crypto?.randomUUID?.()
        ?? `student-mapping-${input.studentId}-${input.subjectId}`,
      studentId: input.studentId,
      subjectId: input.subjectId,
      createdAt: new Date().toISOString(),
    };

    setStudentSubjectMappings((current) => [...current, nextMapping]);
    setPersistenceMode("local");
    return nextMapping;
  };

  const removeStudentSubjectMappingHandler = async (input: RemoveStudentSubjectMappingInput) => {
    const currentMapping = studentSubjectMappings.find((mapping) => mapping.id === input.mappingId);

    if (!currentMapping) {
      return false;
    }

    const localFallbackEnabled = isLocalDemoFallbackEnabled();

    if (authMode === "supabase" && isSupabaseConfigured()) {
      const removed = await removeSupabaseStudentSubjectMapping(input.mappingId);
      if (removed) {
        setStudentSubjectMappings((current) =>
          current.filter((mapping) => mapping.id !== input.mappingId));
        setPersistenceMode("supabase");
        return true;
      }

      if (!localFallbackEnabled) {
        return false;
      }
    }

    setStudentSubjectMappings((current) =>
      current.filter((mapping) => mapping.id !== input.mappingId));
    setPersistenceMode("local");
    return true;
  };

  const submitAssignment = async (input: SubmitAssignmentInput) => {
    if (!user) {
      return null;
    }

    const settings = getSystemSettingsSnapshot();
    const shouldAutoStartAnalysis = settings.autoStartAnalysis;
    const localFallbackEnabled = isLocalDemoFallbackEnabled();
    const existing = submissions.find(
      (submission) => submission.assignmentId === input.assignmentId && submission.studentId === user.id,
    );
    const now = new Date().toISOString();
    const useSupabasePersistence = authMode === "supabase" && isSupabaseConfigured();
    const generatedId = globalThis.crypto?.randomUUID?.() ?? `submission-${Date.now()}`;
    const localCheckId = existing?.latestOriginalityCheckId ?? `check-${generatedId}`;

    const nextSubmission: Submission = {
      id: existing?.id ?? generatedId,
      assignmentId: input.assignmentId,
      studentId: user.id,
      studentName: user.fullName,
      academicId: user.academicId,
      fileName: input.fileName,
      filePath: input.filePath ?? existing?.filePath ?? null,
      fileMimeType: input.fileMimeType ?? existing?.fileMimeType ?? "",
      fileSize: input.fileSize,
      notes: input.notes,
      submittedAt: now,
      originality: !useSupabasePersistence && shouldAutoStartAnalysis ? 82 + Math.floor(Math.random() * 15) : 0,
      status: "submitted",
      grade: null,
      feedback: "",
      semester: existing?.semester ?? "الفصل الثاني 1447",
      analysisStatus: shouldAutoStartAnalysis
        ? (useSupabasePersistence ? "pending" : "completed")
        : "pending",
      analysisRequestedAt: shouldAutoStartAnalysis ? now : null,
      analysisCompletedAt: !useSupabasePersistence && shouldAutoStartAnalysis ? now : null,
      analysisError: "",
      latestOriginalityCheckId: !useSupabasePersistence && shouldAutoStartAnalysis ? localCheckId : null,
      events: createSubmissionEvents(now, "submitted"),
    };

    if (useSupabasePersistence) {
      const remoteSubmission = await upsertSupabaseSubmission(nextSubmission);
      if (remoteSubmission) {
        setSubmissions((current) => mergeSubmission(current, remoteSubmission, existing?.id));
        setOriginalityChecks((current) =>
          current.filter((check) => check.submissionId !== remoteSubmission.id),
        );
        setReviews((current) =>
          current.filter((review) => review.submissionId !== remoteSubmission.id),
        );
        setSubmissionMatches((current) =>
          current.filter((match) => match.submissionId !== remoteSubmission.id),
        );
        setPersistenceMode("supabase");

        await clearSupabaseSubmissionArtifacts(remoteSubmission.id);

        if (!shouldAutoStartAnalysis) {
          return remoteSubmission;
        }

        const analyzedSubmission = await requestSupabaseSubmissionAnalysis(remoteSubmission.id);
        if (analyzedSubmission) {
          const remoteData = await loadSupabaseAcademicData();
          if (remoteData) {
            applyRemoteData(remoteData);
            return (
              remoteData.submissions.find((submission) => submission.id === analyzedSubmission.id)
              ?? analyzedSubmission
            );
          }

          setSubmissions((current) => mergeSubmission(current, analyzedSubmission, remoteSubmission.id));
          return analyzedSubmission;
        }

        return remoteSubmission;
      }

      if (!localFallbackEnabled) {
        return null;
      }
    }

    setSubmissions((current) => mergeSubmission(current, nextSubmission, existing?.id));
    setReviews((current) => current.filter((review) => review.submissionId !== nextSubmission.id));
    setOriginalityChecks((current) => {
      const withoutCurrent = current.filter((check) => check.submissionId !== nextSubmission.id);
      if (!shouldAutoStartAnalysis) {
        return withoutCurrent;
      }

      const derivedCheck = deriveOriginalityChecksFromSubmissions([nextSubmission])[0];
      if (!derivedCheck) {
        return withoutCurrent;
      }

      return [{ ...derivedCheck, id: localCheckId }, ...withoutCurrent];
    });
    setSubmissionMatches((current) =>
      current.filter((match) => match.submissionId !== nextSubmission.id),
    );
    setPersistenceMode("local");
    return nextSubmission;
  };

  const startSubmissionAnalysis = async (submissionId: string) => {
    const currentSubmission = submissions.find((submission) => submission.id === submissionId);
    if (!currentSubmission) {
      return { submission: null, error: "تعذر العثور على التسليم المطلوب." };
    }

    const requestedAt = new Date().toISOString();
    const useSupabasePersistence = authMode === "supabase" && isSupabaseConfigured();
    const localFallbackEnabled = isLocalDemoFallbackEnabled();
    const checkId = currentSubmission.latestOriginalityCheckId ?? `check-${submissionId}`;

    if (useSupabasePersistence) {
      const queuedSubmission: Submission = {
        ...currentSubmission,
        analysisStatus: "processing",
        analysisRequestedAt: requestedAt,
        analysisCompletedAt: null,
        analysisError: "",
        latestOriginalityCheckId: null,
      };

      setSubmissions((current) => mergeSubmission(current, queuedSubmission, submissionId));
      setPersistenceMode("supabase");

      const analysisResult = await requestSupabaseSubmissionAnalysis(queuedSubmission.id);
      if (analysisResult.submission) {
        const remoteData = await loadSupabaseAcademicData();
        if (remoteData) {
          applyRemoteData(remoteData);
          return {
            submission:
              remoteData.submissions.find(
                (submission) => submission.id === analysisResult.submission?.id,
              ) ?? analysisResult.submission,
            error: null,
          };
        }

        setSubmissions((current) =>
          mergeSubmission(current, analysisResult.submission as Submission, queuedSubmission.id),
        );
        return {
          submission: analysisResult.submission,
          error: null,
        };
      }

      const remoteData = await loadSupabaseAcademicData();
      if (remoteData) {
        applyRemoteData(remoteData);
      } else {
        setSubmissions((current) => mergeSubmission(current, currentSubmission, submissionId));
      }

      return {
        submission: null,
        error: analysisResult.error ?? "تعذر تشغيل تحليل الأصالة لهذا التسليم.",
      };
    }

    if (!localFallbackEnabled) {
      return { submission: null, error: "وضع التخزين الحالي لا يسمح ببدء التحليل من هذه الجلسة." };
    }

    const completedSubmission: Submission = {
      ...currentSubmission,
      originality: 82 + Math.floor(Math.random() * 15),
      analysisStatus: "completed",
      analysisRequestedAt: requestedAt,
      analysisCompletedAt: requestedAt,
      analysisError: "",
      latestOriginalityCheckId: checkId,
    };

    setSubmissions((current) =>
      current.map((submission) => (submission.id === submissionId ? completedSubmission : submission)),
    );
    setOriginalityChecks((current) => {
      const withoutCurrent = current.filter((check) => check.submissionId !== submissionId);
      const derivedCheck = deriveOriginalityChecksFromSubmissions([completedSubmission])[0];

      if (!derivedCheck) {
        return withoutCurrent;
      }

      return [{ ...derivedCheck, id: checkId }, ...withoutCurrent];
    });
    setSubmissionMatches((current) =>
      current.filter((match) => match.submissionId !== submissionId),
    );
    setPersistenceMode("local");
    return {
      submission: completedSubmission,
      error: null,
    };
  };

  const reviewSubmission = async (input: ReviewSubmissionInput) => {
    if (!user) {
      return null;
    }

    const currentSubmission = submissions.find((submission) => submission.id === input.submissionId);
    if (!currentSubmission) {
      return null;
    }

    const localFallbackEnabled = isLocalDemoFallbackEnabled();
    const currentReview = reviewMap.get(input.submissionId);
    const now = new Date().toISOString();
    const nextSubmission: Submission = {
      ...currentSubmission,
      status: input.finalDecision,
      grade: input.grade,
      feedback: input.feedback,
      events: createSubmissionEvents(currentSubmission.submittedAt, input.finalDecision, now, now),
    };
    const nextReview: Review = {
      id: currentReview?.id ?? (globalThis.crypto?.randomUUID?.() ?? `review-${Date.now()}`),
      submissionId: input.submissionId,
      teacherId: user.id,
      comments: input.feedback,
      finalDecision: input.finalDecision,
      reviewedAt: now,
      manualEvaluation: {
        grade: input.grade,
        submissionStatus: input.finalDecision,
        originality: currentSubmission.originality,
        analysisStatus: currentSubmission.analysisStatus,
      },
      appealStatus: currentReview?.appealStatus ?? "none",
      createdAt: currentReview?.createdAt ?? now,
      updatedAt: now,
    };

    if (authMode === "supabase" && isSupabaseConfigured()) {
      const remoteResult = await updateSupabaseSubmissionReview({
        submissionId: input.submissionId,
        teacherId: user.id,
        status: nextSubmission.status,
        grade: nextSubmission.grade,
        feedback: nextSubmission.feedback,
        events: nextSubmission.events,
        reviewId: currentReview?.id,
        finalDecision: nextReview.finalDecision,
        reviewedAt: now,
        manualEvaluation: nextReview.manualEvaluation,
      });

      if (remoteResult) {
        setSubmissions((current) => mergeSubmission(current, remoteResult.submission, input.submissionId));
        setReviews((current) => upsertReview(current, remoteResult.review));
        setPersistenceMode("supabase");
        return remoteResult.submission;
      }

      if (!localFallbackEnabled) {
        return null;
      }
    }

    setSubmissions((current) =>
      current.map((submission) => (submission.id === input.submissionId ? nextSubmission : submission)),
    );
    setReviews((current) => upsertReview(current, nextReview));
    setPersistenceMode("local");
    return nextSubmission;
  };

  const getAssignmentById = (assignmentId: string) => assignmentMap.get(assignmentId);
  const getSubjectById = (subjectId: string) => subjectMap.get(subjectId);
  const getLatestOriginalityCheckBySubmissionId = (submissionId: string) => {
    const submission = getSubmissionById(submissionId);
    const linkedCheck = submission?.latestOriginalityCheckId;
    if (linkedCheck) {
      return originalityCheckMap.get(linkedCheck) ?? originalityCheckBySubmissionMap.get(submissionId);
    }

    if (submission && submission.analysisStatus !== "completed") {
      return undefined;
    }

    return originalityCheckBySubmissionMap.get(submissionId);
  };
  const getReviewBySubmissionId = (submissionId: string) => reviewMap.get(submissionId);
  const getSubmissionMatches = (submissionId: string) =>
    submissionMatches
      .filter((match) => match.submissionId === submissionId)
      .sort((left, right) => left.rankOrder - right.rankOrder);
  const getSubmissionById = (submissionId: string) =>
    submissions.find((submission) => submission.id === submissionId);

  const getStudentAssignments = (studentId: string) => {
    const availableAssignments = assignments.filter((assignment) => assignment.status !== "draft");
    return availableAssignments.filter((assignment) =>
      canStudentAccessAssignmentWithMappings(assignment, studentSubjectMappings, studentId));
  };

  const getStudentSubmission = (studentId: string, assignmentId: string) =>
    submissions.find(
      (submission) => submission.studentId === studentId && submission.assignmentId === assignmentId,
    );

  const getStudentSubmissions = (studentId: string) =>
    submissions
      .filter((submission) => submission.studentId === studentId)
      .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt));

  const getTeacherAssignments = (teacherId: string) =>
    assignments
      .filter((assignment) => assignment.teacherId === teacherId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const getTeacherSubjects = (teacherId: string) => {
    const mappedSubjects = Array.from(
      new Map(
        (teacherSubjectMap.get(teacherId) ?? [])
          .map((mapping) => subjectMap.get(mapping.subjectId))
          .filter((subject): subject is AcademicSubject => Boolean(subject))
          .map((subject) => [subject.id, subject]),
      ).values(),
    );

    if (mappedSubjects.length > 0) {
      return mappedSubjects;
    }

    const referencedSubjects = Array.from(
      new Map(
        getTeacherAssignments(teacherId)
          .map((assignment) => assignment.subjectId)
          .filter((subjectId): subjectId is string => Boolean(subjectId))
          .map((subjectId) => subjectMap.get(subjectId))
          .filter((subject): subject is AcademicSubject => Boolean(subject))
          .map((subject) => [subject.id, subject]),
      ).values(),
    );

    if (referencedSubjects.length > 0) {
      return referencedSubjects;
    }

    return deriveSubjectsFromAssignments(getTeacherAssignments(teacherId));
  };

  const getTeacherSubmissions = (teacherId: string) =>
    submissions
      .filter((submission) => {
        const assignment = assignmentMap.get(submission.assignmentId);
        return assignment?.teacherId === teacherId;
      })
      .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt));

  return (
    <AcademicDataContext.Provider
      value={{
        activityFeed,
        assignments,
        isRefreshing,
        originalityChecks,
        reviews,
        studentSubjectMappings,
        submissionMatches,
        submissions,
        subjects,
        teacherSubjectMappings,
        persistenceMode,
        createAssignment,
        createSubject,
        updateSubject,
        deleteSubject: deleteSubjectHandler,
        assignTeacherSubject,
        removeTeacherSubjectMapping: removeTeacherSubjectMappingHandler,
        assignStudentSubject,
        removeStudentSubjectMapping: removeStudentSubjectMappingHandler,
        refreshAcademicData,
        startSubmissionAnalysis,
        submitAssignment,
        reviewSubmission,
        getAssignmentById,
        getLatestOriginalityCheckBySubmissionId,
        getReviewBySubmissionId,
        getSubjectById,
        getSubmissionMatches,
        getSubmissionById,
        getStudentAssignments,
        getStudentSubmission,
        getStudentSubmissions,
        getTeacherAssignments,
        getTeacherSubjects,
        getTeacherSubmissions,
      }}
    >
      {children}
    </AcademicDataContext.Provider>
  );
}

export function useAcademicData() {
  const context = useContext(AcademicDataContext);
  if (!context) {
    throw new Error("useAcademicData must be used within AcademicDataProvider");
  }
  return context;
}
