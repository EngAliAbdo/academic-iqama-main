import type { AuthUser, UserRole } from "@/lib/auth";
import {
  getOriginalityRiskLabel,
  getOriginalityRiskLevel,
  getReviewDecisionLabel,
  type Assignment,
  type OriginalityCheck,
  type Review,
  type Submission,
} from "@/lib/academic-data";
import { roleLabels } from "@/lib/role-capabilities";
import type { SystemSettings, SystemSettingsActivityDetail } from "@/lib/system-settings";

export type ActivityCategory = "assignment" | "submission" | "analysis" | "review" | "settings";
export type ActivityPriority = "normal" | "attention" | "critical";
export type ActivityBadgeVariant =
  | "draft"
  | "published"
  | "submitted"
  | "review"
  | "revision"
  | "graded"
  | "accepted"
  | "rejected"
  | "flagged"
  | "closed";

export interface ActivityFeedItem {
  id: string;
  actorName: string;
  actorRole: UserRole | "system";
  actorRoleLabel: string;
  action: string;
  details: string;
  category: ActivityCategory;
  categoryLabel: string;
  occurredAt: string;
  statusLabel: string;
  statusVariant: ActivityBadgeVariant;
  priority: ActivityPriority;
}

export function isFailedAnalysisActivity(item: Pick<ActivityFeedItem, "category" | "statusVariant">) {
  return item.category === "analysis" && item.statusVariant === "rejected";
}

function withAnalysisError(details: string, analysisError?: string | null) {
  if (!analysisError) {
    return details;
  }

  return `${details} - ${analysisError}`;
}

interface BuildActivityFeedInput {
  assignments: Assignment[];
  originalityChecks: OriginalityCheck[];
  reviews: Review[];
  submissions: Submission[];
  users?: AuthUser[];
}

function summarizeSettingsChange(previousSettings: SystemSettings, nextSettings: SystemSettings) {
  const changes: string[] = [];

  if (previousSettings.maxUploadSizeMb !== nextSettings.maxUploadSizeMb) {
    changes.push(`رفع ${nextSettings.maxUploadSizeMb}MB`);
  }

  if (
    previousSettings.highRiskBelow !== nextSettings.highRiskBelow
    || previousSettings.mediumRiskBelow !== nextSettings.mediumRiskBelow
    || previousSettings.suspiciousAlertBelow !== nextSettings.suspiciousAlertBelow
  ) {
    changes.push(
      `الخطورة ${nextSettings.highRiskBelow}/${nextSettings.mediumRiskBelow}/${nextSettings.suspiciousAlertBelow}%`,
    );
  }

  if (
    previousSettings.autoStartAnalysis !== nextSettings.autoStartAnalysis
    || previousSettings.manualReviewOnExtractionFailure !== nextSettings.manualReviewOnExtractionFailure
  ) {
    changes.push(
      `${nextSettings.autoStartAnalysis ? "تحليل تلقائي" : "تحليل يدوي"} / ${nextSettings.manualReviewOnExtractionFailure ? "مراجعة يدوية" : "فشل مباشر"}`,
    );
  }

  if (
    previousSettings.allowedSubmissionFormats.join(",") !== nextSettings.allowedSubmissionFormats.join(",")
  ) {
    changes.push(`الصيغ ${nextSettings.allowedSubmissionFormats.join(", ")}`);
  }

  if (
    previousSettings.institutionName !== nextSettings.institutionName
    || previousSettings.academicYear !== nextSettings.academicYear
  ) {
    changes.push(`${nextSettings.institutionName} - ${nextSettings.academicYear}`);
  }

  return changes.length > 0
    ? changes.join(" - ")
    : `${nextSettings.institutionName} - ${nextSettings.academicYear}`;
}

export function getActivityCategoryLabel(category: ActivityCategory) {
  const labels: Record<ActivityCategory, string> = {
    assignment: "التكليفات",
    submission: "التسليمات",
    analysis: "تحليلات الأصالة",
    review: "مراجعات المعلم",
    settings: "إعدادات النظام",
  };

  return labels[category];
}

export function getActorRoleLabel(role: UserRole | "system") {
  if (role === "system") {
    return "النظام";
  }

  return roleLabels[role];
}

export function getActivityPriorityLabel(priority: ActivityPriority) {
  return {
    normal: "عادي",
    attention: "يتطلب متابعة",
    critical: "حرج",
  }[priority];
}

export function getActivityPriorityClass(priority: ActivityPriority) {
  return {
    normal: "bg-muted text-muted-foreground",
    attention: "bg-warning/10 text-warning",
    critical: "bg-destructive/10 text-destructive",
  }[priority];
}

export function buildSystemSettingsActivityItem(
  detail: SystemSettingsActivityDetail,
): ActivityFeedItem {
  const changed = JSON.stringify(detail.previousSettings) !== JSON.stringify(detail.nextSettings);

  return {
    id: `local-settings-${detail.occurredAt}`,
    actorName: detail.actorName,
    actorRole: detail.actorRole,
    actorRoleLabel: getActorRoleLabel(detail.actorRole),
    action: changed ? "حدّث إعدادات النظام" : "اعتمد إعدادات النظام",
    details: summarizeSettingsChange(detail.previousSettings, detail.nextSettings),
    category: "settings",
    categoryLabel: getActivityCategoryLabel("settings"),
    occurredAt: detail.occurredAt,
    statusLabel: detail.storageMode === "supabase" ? "تمت المزامنة" : "محفوظ محلياً",
    statusVariant: "published",
    priority: "normal",
  };
}

export function buildActivityFeed({
  assignments,
  originalityChecks,
  reviews,
  submissions,
  users = [],
}: BuildActivityFeedInput): ActivityFeedItem[] {
  const userMap = new Map(users.map((user) => [user.id, user]));
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const submissionMap = new Map(submissions.map((submission) => [submission.id, submission]));
  const originalityCheckMap = new Map(
    originalityChecks.map((check) => [check.submissionId, check]),
  );

  const assignmentEvents: ActivityFeedItem[] = assignments.map((assignment) => {
    const actor = userMap.get(assignment.teacherId);

    return {
      id: `assignment-${assignment.id}`,
      actorName: actor?.fullName ?? assignment.teacherName,
      actorRole: actor?.role ?? "teacher",
      actorRoleLabel: getActorRoleLabel(actor?.role ?? "teacher"),
      action: "أنشأ تكليفاً",
      details: `${assignment.title} - ${assignment.subject}`,
      category: "assignment",
      categoryLabel: getActivityCategoryLabel("assignment"),
      occurredAt: assignment.createdAt,
      statusLabel:
        assignment.status === "draft"
          ? "مسودة"
          : assignment.status === "closed"
            ? "مغلق"
            : "منشور",
      statusVariant:
        assignment.status === "draft"
          ? "draft"
          : assignment.status === "closed"
            ? "closed"
            : "published",
      priority: "normal",
    };
  });

  const submissionEvents: ActivityFeedItem[] = submissions.map((submission) => {
    const assignment = assignmentMap.get(submission.assignmentId);
    const actor = userMap.get(submission.studentId);
    const studentName = actor?.fullName ?? submission.studentName ?? "حساب محذوف";

    return {
      id: `submission-${submission.id}`,
      actorName: studentName,
      actorRole: "student",
      actorRoleLabel: getActorRoleLabel("student"),
      action: "رفع تسليماً",
      details: `${assignment?.title ?? "تكليف"} - ${submission.fileName}`,
      category: "submission",
      categoryLabel: getActivityCategoryLabel("submission"),
      occurredAt: submission.submittedAt,
      statusLabel: "تم الرفع",
      statusVariant: "submitted",
      priority: "normal",
    };
  });

  const analysisEvents: ActivityFeedItem[] = submissions.flatMap((submission) => {
    const assignment = assignmentMap.get(submission.assignmentId);
    const check = originalityCheckMap.get(submission.id);
    const actor = userMap.get(submission.studentId);
    const studentName = actor?.fullName ?? submission.studentName ?? "حساب محذوف";
    const events: ActivityFeedItem[] = [];

    if (submission.analysisRequestedAt) {
      events.push({
        id: `analysis-request-${submission.id}`,
        actorName: "النظام",
        actorRole: "system",
        actorRoleLabel: getActorRoleLabel("system"),
        action: "بدأ تحليل الأصالة",
        details: `${assignment?.title ?? "تكليف"} - ${studentName}`,
        category: "analysis",
        categoryLabel: getActivityCategoryLabel("analysis"),
        occurredAt: submission.analysisRequestedAt,
        statusLabel: "قيد التحليل",
        statusVariant: "review",
        priority: "normal",
      });
    }

    const analysisTimestamp = submission.analysisCompletedAt ?? submission.analysisRequestedAt;
    if (!analysisTimestamp || submission.analysisStatus === "pending" || submission.analysisStatus === "processing") {
      return events;
    }

    if (submission.analysisStatus === "manual_review_required") {
      events.push({
        id: `analysis-manual-${submission.id}`,
        actorName: "النظام",
        actorRole: "system",
        actorRoleLabel: getActorRoleLabel("system"),
        action: "حوّل الحالة إلى مراجعة يدوية",
        details: `${assignment?.title ?? "تكليف"} - ${studentName}`,
        category: "analysis",
        categoryLabel: getActivityCategoryLabel("analysis"),
        occurredAt: analysisTimestamp,
        statusLabel: "مراجعة يدوية",
        statusVariant: "revision",
        priority: "attention",
      });

      const latestManualEvent = events[events.length - 1];
      if (latestManualEvent) {
        latestManualEvent.details = withAnalysisError(latestManualEvent.details, submission.analysisError);
      }

      return events;
    }

    if (submission.analysisStatus === "failed") {
      events.push({
        id: `analysis-failed-${submission.id}`,
        actorName: "النظام",
        actorRole: "system",
        actorRoleLabel: getActorRoleLabel("system"),
        action: "فشل تحليل الأصالة",
        details: `${assignment?.title ?? "تكليف"} - ${studentName}`,
        category: "analysis",
        categoryLabel: getActivityCategoryLabel("analysis"),
        occurredAt: analysisTimestamp,
        statusLabel: "فشل التحليل",
        statusVariant: "rejected",
        priority: "attention",
      });

      const latestFailedEvent = events[events.length - 1];
      if (latestFailedEvent) {
        latestFailedEvent.details = withAnalysisError(latestFailedEvent.details, submission.analysisError);
      }

      return events;
    }

    const riskLevel = getOriginalityRiskLevel(submission);
    const originalityScore = check?.originalityScore ?? submission.originality;

    events.push({
      id: `analysis-completed-${submission.id}`,
      actorName: "النظام",
      actorRole: "system",
      actorRoleLabel: getActorRoleLabel("system"),
      action:
        riskLevel === "high"
          ? "اكتمل التحليل مع اشتباه مرتفع"
          : riskLevel === "medium"
            ? "اكتمل التحليل ويحتاج متابعة"
            : "اكتمل تحليل الأصالة",
      details: `${assignment?.title ?? "تكليف"} - ${studentName} - أصالة ${originalityScore}%`,
      category: "analysis",
      categoryLabel: getActivityCategoryLabel("analysis"),
      occurredAt: analysisTimestamp,
      statusLabel: getOriginalityRiskLabel(riskLevel),
      statusVariant:
        riskLevel === "high" ? "flagged" : riskLevel === "medium" ? "review" : "accepted",
      priority: riskLevel === "high" ? "critical" : riskLevel === "medium" ? "attention" : "normal",
    });

    return events;
  });

  const reviewEvents: ActivityFeedItem[] = reviews.flatMap((review) => {
    if (!review.reviewedAt) {
      return [];
    }

    const submission = submissionMap.get(review.submissionId);
    const assignment = submission ? assignmentMap.get(submission.assignmentId) : undefined;
    const actor = userMap.get(review.teacherId);
    const studentActor = submission ? userMap.get(submission.studentId) : undefined;
    const studentName = studentActor?.fullName ?? submission?.studentName ?? "طالب";
    const decisionLabel = getReviewDecisionLabel(review.finalDecision);
    const gradeLabel =
      review.manualEvaluation.grade !== null ? ` - الدرجة ${review.manualEvaluation.grade}` : "";

    return [
      {
        id: `review-${review.id}`,
        actorName: actor?.fullName ?? assignment?.teacherName ?? "المعلم",
        actorRole: actor?.role ?? "teacher",
        actorRoleLabel: getActorRoleLabel(actor?.role ?? "teacher"),
        action: review.finalDecision ? "أصدر قرار المراجعة" : "سجل ملاحظات التقييم",
        details: `${studentName} - ${assignment?.title ?? "تكليف"} - ${decisionLabel}${gradeLabel}`,
        category: "review",
        categoryLabel: getActivityCategoryLabel("review"),
        occurredAt: review.reviewedAt,
        statusLabel: decisionLabel,
        statusVariant:
          review.finalDecision === "accepted"
            ? "accepted"
            : review.finalDecision === "rejected"
              ? "rejected"
              : review.finalDecision === "revision"
                ? "revision"
                : review.manualEvaluation.grade !== null
                  ? "graded"
                  : "review",
        priority:
          review.finalDecision === "rejected"
          || review.finalDecision === "revision"
          || review.manualEvaluation.submissionStatus === "flagged"
            ? "attention"
            : "normal",
      },
    ];
  });

  return [...assignmentEvents, ...submissionEvents, ...analysisEvents, ...reviewEvents].sort(
    (left, right) => +new Date(right.occurredAt) - +new Date(left.occurredAt),
  );
}
