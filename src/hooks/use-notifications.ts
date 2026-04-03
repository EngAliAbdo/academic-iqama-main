import { useCallback, useEffect, useMemo, useState } from "react";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatDateLabel,
  getOriginalityRiskLevel,
  isAnalysisPending,
  isSuspiciousSubmission,
  isDueSoon,
} from "@/lib/academic-data";
import {
  isSupabaseConfigured,
  loadSupabaseNotificationReadIds,
  upsertSupabaseNotificationReads,
} from "@/lib/supabase-app";
import {
  DEFAULT_PREFERENCES,
  USER_PREFERENCES_EVENT,
  loadUserPreferences,
  type UserPreferencesChangeEventDetail,
  type UserPreferences,
} from "@/lib/user-preferences";

export type NotificationType = "grade" | "deadline" | "feedback" | "submission" | "system";

export interface Notification {
  id: string;
  title: string;
  description: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

const NOTIFICATIONS_STORAGE_PREFIX = "academic-iqama.notifications.read";

function getStorageKey(userId: string) {
  return `${NOTIFICATIONS_STORAGE_PREFIX}.${userId}`;
}

export function useNotifications() {
  const { authMode, directoryUsers, user } = useAuth();
  const {
    assignments,
    submissions,
    getAssignmentById,
    getStudentAssignments,
    getStudentSubmissions,
    getTeacherAssignments,
    getTeacherSubmissions,
  } = useAcademicData();
  const [readIds, setReadIds] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    let cancelled = false;

    const loadReadState = async () => {
      if (!user) {
        setReadIds([]);
        return;
      }

      if (authMode === "supabase" && isSupabaseConfigured()) {
        const remoteReadIds = await loadSupabaseNotificationReadIds();
        if (!cancelled) {
          setReadIds(remoteReadIds ?? []);
        }
        return;
      }

      const raw = localStorage.getItem(getStorageKey(user.id));
      if (!raw) {
        setReadIds([]);
        return;
      }

      try {
        const parsed = JSON.parse(raw) as string[];
        setReadIds(Array.isArray(parsed) ? parsed : []);
      } catch {
        setReadIds([]);
      }
    };

    void loadReadState();

    return () => {
      cancelled = true;
    };
  }, [authMode, user]);

  useEffect(() => {
    const syncPreferences = () => {
      setPreferences(loadUserPreferences(user?.id));
    };

    const handleCustomPreferencesEvent = (event: Event) => {
      const customEvent = event as CustomEvent<UserPreferencesChangeEventDetail>;
      const detail = customEvent.detail;

      if (detail?.userId && detail.userId !== user?.id) {
        return;
      }

      setPreferences(detail?.preferences ?? loadUserPreferences(user?.id));
    };

    syncPreferences();
    window.addEventListener("storage", syncPreferences);
    window.addEventListener(USER_PREFERENCES_EVENT, handleCustomPreferencesEvent as EventListener);

    return () => {
      window.removeEventListener("storage", syncPreferences);
      window.removeEventListener(
        USER_PREFERENCES_EVENT,
        handleCustomPreferencesEvent as EventListener,
      );
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (authMode === "supabase") {
      return;
    }

    localStorage.setItem(getStorageKey(user.id), JSON.stringify(readIds));
  }, [authMode, readIds, user]);

  const notifications = useMemo<Notification[]>(() => {
    if (!user) return [];

    const items: Notification[] = [];

    if (user.role === "student") {
      const studentAssignments = getStudentAssignments(user.id);
      const studentSubmissions = getStudentSubmissions(user.id);

      studentAssignments
        .filter((assignment) => assignment.status === "published")
        .filter((assignment) => !studentSubmissions.some((submission) => submission.assignmentId === assignment.id))
        .forEach((assignment) => {
          items.push({
            id: `assignment-published-${assignment.id}`,
            title: "تم نشر تكليف جديد",
            description: `${assignment.subject} - ${assignment.title}`,
            type: "system",
            createdAt: assignment.createdAt,
            read: false,
          });
        });

      if (preferences.deadlineAlerts) {
        studentAssignments
          .filter((assignment) => !studentSubmissions.some((submission) => submission.assignmentId === assignment.id))
          .filter((assignment) => isDueSoon(assignment.dueAt))
          .forEach((assignment) => {
            items.push({
              id: `deadline-${assignment.id}`,
              title: "موعد تسليم قريب",
              description: `${assignment.title} - آخر موعد ${formatDateLabel(assignment.dueAt)}`,
              type: "deadline",
              createdAt: assignment.dueAt,
              read: false,
            });
          });
      }

      studentSubmissions.forEach((submission) => {
        const assignment = getAssignmentById(submission.assignmentId);

        items.push({
          id: `submission-${submission.id}`,
          title: "تم تسجيل تسليمك",
          description: `${assignment?.title ?? "تكليف"} - تم رفع الملف ${submission.fileName}`,
          type: "submission",
          createdAt: submission.submittedAt,
          read: false,
        });

        if (isAnalysisPending(submission.analysisStatus)) {
          items.push({
            id: `analysis-pending-${submission.id}`,
            title: "تحليل الأصالة بدأ",
            description: `${assignment?.title ?? "تكليف"} - يجري الآن فحص الملف وإعداد النتيجة`,
            type: "system",
            createdAt: submission.analysisRequestedAt ?? submission.submittedAt,
            read: false,
          });
        }

        if (submission.analysisStatus === "manual_review_required") {
          items.push({
            id: `analysis-manual-${submission.id}`,
            title: "يتطلب مراجعة يدوية",
            description: `${assignment?.title ?? "تكليف"} - تعذر تحليل الملف آلياً وتم تحويله للمراجعة`,
            type: "feedback",
            createdAt: submission.analysisCompletedAt ?? submission.submittedAt,
            read: false,
          });
        }

        if (submission.analysisStatus === "failed") {
          items.push({
            id: `analysis-failed-${submission.id}`,
            title: "فشل تحليل الأصالة",
            description: `${assignment?.title ?? "تكليف"} - ${submission.analysisError || "تعذر استكمال فحص الملف آلياً"}`,
            type: "feedback",
            createdAt: submission.analysisCompletedAt ?? submission.analysisRequestedAt ?? submission.submittedAt,
            read: false,
          });
        }

        if (submission.analysisStatus === "completed") {
          items.push({
            id: `analysis-complete-${submission.id}`,
            title: "نتيجة الأصالة جاهزة",
            description: `${assignment?.title ?? "تكليف"} - تم تحديث نتيجة الأصالة بنجاح`,
            type: "system",
            createdAt: submission.analysisCompletedAt ?? submission.submittedAt,
            read: false,
          });
        }

        if (submission.grade !== null) {
          items.push({
            id: `grade-${submission.id}`,
            title: "تم تحديث الدرجة",
            description: `${assignment?.title ?? "تكليف"} - الدرجة ${submission.grade}/100`,
            type: "grade",
            createdAt: submission.events[submission.events.length - 1]?.at ?? submission.submittedAt,
            read: false,
          });
        }

        if (submission.feedback) {
          items.push({
            id: `feedback-${submission.id}`,
            title: "وصلتك ملاحظات جديدة",
            description: `${assignment?.title ?? "تكليف"} - ${submission.feedback}`,
            type: "feedback",
            createdAt: submission.events[submission.events.length - 1]?.at ?? submission.submittedAt,
            read: false,
          });
        }
      });

      if (preferences.weeklySummary) {
        items.push({
          id: `system-student-${user.id}`,
          title: "ملخص حسابك",
          description: `لديك ${studentAssignments.length} تكليفات منشورة و${studentSubmissions.length} تسليمات محفوظة في النظام`,
          type: "system",
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    }

    if (user.role === "teacher") {
      const teacherAssignments = getTeacherAssignments(user.id);
      const teacherSubmissions = getTeacherSubmissions(user.id);

      teacherSubmissions.forEach((submission) => {
        const assignment = getAssignmentById(submission.assignmentId);
        const riskLevel = getOriginalityRiskLevel(submission);

        items.push({
          id: `teacher-submission-${submission.id}`,
          title: "وصل تسليم جديد",
          description: `${submission.studentName} - ${assignment?.title ?? "تكليف"}`,
          type: "submission",
          createdAt: submission.submittedAt,
          read: false,
        });

        if (isAnalysisPending(submission.analysisStatus)) {
          items.push({
            id: `teacher-analysis-pending-${submission.id}`,
            title: "تحليل أصالة قيد التنفيذ",
            description: `${submission.studentName} - ${assignment?.title ?? "تكليف"}`,
            type: "system",
            createdAt: submission.analysisRequestedAt ?? submission.submittedAt,
            read: false,
          });
        }

        if (riskLevel === "high") {
          items.push({
            id: `teacher-risk-high-${submission.id}`,
            title: "تسليم عالي الخطورة",
            description: `${submission.studentName} - أصالة ${submission.originality}% وتتطلب مراجعة دقيقة`,
            type: "feedback",
            createdAt: submission.analysisCompletedAt ?? submission.submittedAt,
            read: false,
          });
        }

        if (submission.analysisStatus === "manual_review_required") {
          items.push({
            id: `teacher-manual-${submission.id}`,
            title: "تحويل إلى مراجعة يدوية",
            description: `${submission.studentName} - ${assignment?.title ?? "تكليف"}`,
            type: "feedback",
            createdAt: submission.analysisCompletedAt ?? submission.submittedAt,
            read: false,
          });
        }
      });

      teacherSubmissions
        .filter((submission) => submission.analysisStatus === "failed")
        .forEach((submission) => {
          const assignment = getAssignmentById(submission.assignmentId);

          items.push({
            id: `teacher-analysis-failed-${submission.id}`,
            title: "فشل تحليل الأصالة",
            description: `${submission.studentName} - ${assignment?.title ?? "تكليف"}${submission.analysisError ? ` - ${submission.analysisError}` : ""}`,
            type: "feedback",
            createdAt: submission.analysisCompletedAt ?? submission.analysisRequestedAt ?? submission.submittedAt,
            read: false,
          });
        });

      if (preferences.weeklySummary) {
        items.push({
          id: `system-teacher-${user.id}`,
          title: "ملخص المواد الحالية",
          description: `لديك ${teacherAssignments.length} تكليفات و${teacherSubmissions.length} تسليمات مرتبطة بها`,
          type: "system",
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    }

    if (user.role === "admin") {
      const suspicious = submissions.filter(isSuspiciousSubmission).length;
      const pendingAnalysis = submissions.filter((submission) => isAnalysisPending(submission.analysisStatus)).length;
      const failedAnalysis = submissions.filter((submission) => submission.analysisStatus === "failed").length;

      if (preferences.weeklySummary) {
        items.push({
          id: "admin-system-overview",
          title: "ملخص النظام",
          description: `إجمالي المستخدمين ${directoryUsers.length}، التكليفات ${assignments.length}، التسليمات ${submissions.length}`,
          type: "system",
          createdAt: new Date().toISOString(),
          read: false,
        });
      }

      if (suspicious > 0) {
        items.push({
          id: "admin-suspicious-alert",
          title: "حالات تحتاج متابعة إدارية",
          description: `يوجد ${suspicious} تسليمات بين حالات مرتفعة الخطورة أو مراجعات يدوية`,
          type: "feedback",
          createdAt: new Date().toISOString(),
          read: false,
        });
      }

      if (pendingAnalysis > 0) {
        items.push({
          id: "admin-pending-analysis",
          title: "تحليلات أصالة معلقة",
          description: `يوجد ${pendingAnalysis} تسليمات ما زالت قيد التحليل`,
          type: "system",
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
      if (failedAnalysis > 0) {
        items.push({
          id: "admin-failed-analysis",
          title: "تحاليل فاشلة تحتاج متابعة",
          description: `يوجد ${failedAnalysis} تسليمات تعذر استكمال تحليل الأصالة لها`,
          type: "feedback",
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    }

    return items
      .map((item) => ({ ...item, read: readIds.includes(item.id) }))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [
    assignments,
    directoryUsers.length,
    getAssignmentById,
    getStudentAssignments,
    getStudentSubmissions,
    getTeacherAssignments,
    getTeacherSubmissions,
    preferences.deadlineAlerts,
    preferences.weeklySummary,
    readIds,
    submissions,
    user,
  ]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const markAsRead = useCallback((id: string) => {
    setReadIds((current) => (current.includes(id) ? current : [...current, id]));
    if (authMode === "supabase" && isSupabaseConfigured()) {
      void upsertSupabaseNotificationReads([id]);
    }
  }, [authMode]);

  const markAllAsRead = useCallback(() => {
    const ids = notifications.map((notification) => notification.id);
    setReadIds(ids);

    if (authMode === "supabase" && isSupabaseConfigured()) {
      void upsertSupabaseNotificationReads(ids);
    }
  }, [authMode, notifications]);

  const getByType = useCallback(
    (type: NotificationType | "all") => {
      if (type === "all") return notifications;
      return notifications.filter((notification) => notification.type === type);
    },
    [notifications],
  );

  return { notifications, unreadCount, markAsRead, markAllAsRead, getByType };
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  grade: "الدرجات",
  deadline: "المواعيد",
  feedback: "الملاحظات",
  submission: "التسليمات",
  system: "النظام",
};
