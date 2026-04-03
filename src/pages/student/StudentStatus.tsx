import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { TimelineStepper } from "@/components/TimelineStepper";
import { Button } from "@/components/ui/button";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  getReviewDecisionLabel,
  formatDateTimeLabel,
  getSubmissionAnalysisStatusLabel,
  getSubmissionBadgeVariant,
  isAnalysisPending,
  type Review,
  type Submission,
} from "@/lib/academic-data";

function getCurrentStepIndex(submission: Submission) {
  if (submission.analysisStatus === "pending") {
    return 1;
  }

  if (
    submission.analysisStatus === "processing"
    || submission.analysisStatus === "manual_review_required"
    || submission.analysisStatus === "failed"
    || submission.status === "submitted"
  ) {
    return 2;
  }

  if (submission.status === "review" || submission.status === "flagged") {
    return 3;
  }

  return 4;
}

function getFinalStepLabel(submission: Submission, review: Review | undefined) {
  if (review?.finalDecision) {
    return getReviewDecisionLabel(review.finalDecision);
  }

  if (submission.status === "revision") {
    return "يحتاج تعديل";
  }

  if (submission.status === "rejected") {
    return "غير مقبول";
  }

  if (submission.status === "accepted") {
    return "مقبول";
  }

  if (submission.status === "flagged") {
    return "مشتبه";
  }

  return submission.grade !== null ? "تم التقييم" : "القرار النهائي";
}

function buildTimelineSteps(submission: Submission, review: Review | undefined) {
  const currentStep = getCurrentStepIndex(submission);
  const steps = [
    {
      label: "تم الرفع",
      at: submission.submittedAt,
    },
    {
      label: "تم الاستلام",
      at: submission.submittedAt,
    },
    {
      label: "فحص الأصالة",
      at: submission.analysisCompletedAt ?? submission.analysisRequestedAt ?? "",
    },
    {
      label: "مراجعة المعلم",
      at:
        review?.reviewedAt
        ?? submission.analysisCompletedAt
        ?? submission.analysisRequestedAt
        ?? "",
    },
    {
      label: getFinalStepLabel(submission, review),
      at:
        review?.reviewedAt
        ?? (submission.status !== "submitted" && submission.status !== "review" && submission.status !== "flagged"
          ? submission.analysisCompletedAt ?? submission.analysisRequestedAt ?? submission.submittedAt
          : ""),
    },
  ];

  return steps.map((step, index) => ({
    label: step.label,
    date: index <= currentStep && step.at ? formatDateTimeLabel(step.at) : "",
    completed: index < currentStep,
    active: index === currentStep,
  }));
}

export default function StudentStatus() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    getAssignmentById,
    getReviewBySubmissionId,
    getStudentSubmissions,
    isRefreshing,
    persistenceMode,
    refreshAcademicData,
  } = useAcademicData();
  const userId = user?.id ?? "";
  const highlightedAssignmentId = searchParams.get("assignment");

  const submissions = useMemo(() => {
    if (!userId) {
      return [];
    }

    const all = getStudentSubmissions(userId);
    if (!highlightedAssignmentId) {
      return all;
    }

    return [
      ...all.filter((submission) => submission.assignmentId === highlightedAssignmentId),
      ...all.filter((submission) => submission.assignmentId !== highlightedAssignmentId),
    ];
  }, [getStudentSubmissions, highlightedAssignmentId, userId]);

  const canRefreshRemotely = persistenceMode === "supabase";
  const hasRunningAnalyses = submissions.some(
    (submission) =>
      isAnalysisPending(submission.analysisStatus) && Boolean(submission.analysisRequestedAt),
  );

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold">حالة التسليمات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          تتبع حالة كل تكليف قمت برفعه ومرحلة تحليل الأصالة الخاصة به.
        </p>
      </div>

      {canRefreshRemotely && (
        <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {hasRunningAnalyses
              ? "يتم تحديث الحالة تلقائياً كل 15 ثانية أثناء وجود تحليلات قيد التنفيذ."
              : "يمكنك تحديث البيانات يدوياً في أي وقت لجلب آخر حالة من قاعدة البيانات."}
          </p>
          <Button
            variant="outline"
            className="gap-2 rounded-xl sm:self-start"
            disabled={isRefreshing}
            onClick={() => {
              void refreshAcademicData();
            }}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {submissions.map((submission) => {
          const assignment = getAssignmentById(submission.assignmentId);
          const review = getReviewBySubmissionId(submission.id);
          const analysisStarted = Boolean(submission.analysisRequestedAt);
          const timelineSteps = buildTimelineSteps(submission, review);
          const latestTimestamp =
            review?.reviewedAt
            ?? submission.analysisCompletedAt
            ?? submission.analysisRequestedAt
            ?? submission.submittedAt;

          return (
            <div key={submission.id} className="rounded-2xl bg-card p-6 shadow-card">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1 break-words font-semibold" title={assignment?.title ?? "تكليف"}>
                    {assignment?.title ?? "تكليف"}
                  </h3>
                  <p className="truncate text-xs text-muted-foreground" title={assignment?.subject ?? "-"}>
                    {assignment?.subject ?? "-"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    آخر تحديث: {formatDateTimeLabel(latestTimestamp)}
                  </p>
                </div>

                <div className="space-y-2 text-left">
                  <StatusBadge variant={getSubmissionBadgeVariant(submission.status)} className="w-fit" />
                  <StatusBadge
                    variant={
                      submission.analysisStatus === "completed"
                        ? "accepted"
                        : submission.analysisStatus === "failed"
                          || submission.analysisStatus === "manual_review_required"
                          ? "revision"
                          : "review"
                    }
                    label={getSubmissionAnalysisStatusLabel(submission.analysisStatus)}
                    className="w-fit"
                  />
                </div>
              </div>

              <TimelineStepper steps={timelineSteps} />

              <div className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-sm">
                {submission.analysisStatus === "pending" && !analysisStarted && (
                  <p className="text-muted-foreground">
                    تم حفظ التسليم بنجاح، لكنه ما زال بانتظار بدء التحليل من قبل النظام أو المعلم.
                  </p>
                )}

                {isAnalysisPending(submission.analysisStatus) && analysisStarted && (
                  <p className="text-muted-foreground">
                    يتم الآن تجهيز الملف وتحليل الأصالة، وستظهر النتيجة هنا تلقائياً عند اكتمال
                    المعالجة.
                  </p>
                )}

                {submission.analysisStatus === "completed" && (
                  <p className="text-muted-foreground">
                    اكتمل تحليل الأصالة ويمكنك مراجعة النتيجة المختصرة من صفحة الأصالة.
                  </p>
                )}

                {submission.analysisStatus === "manual_review_required" && (
                  <p className="text-warning">
                    تعذر استخراج النص آلياً من الملف، وتم تحويله إلى مراجعة يدوية من قبل المعلم.
                  </p>
                )}

                {submission.analysisStatus === "failed" && (
                  <p className="text-destructive">
                    فشل تحليل الأصالة لهذه النسخة حالياً. يمكن للمعلم متابعة الحالة أو طلب إعادة
                    التشغيل.
                  </p>
                )}

                {review?.reviewedAt && (
                  <p className="mt-3 text-muted-foreground">
                    آخر مراجعة من المعلم: {formatDateTimeLabel(review.reviewedAt)}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link to={`/student/originality?assignment=${submission.assignmentId}`}>
                    <Button variant="outline" size="sm" className="rounded-xl">
                      متابعة الأصالة
                    </Button>
                  </Link>
                  {(review?.reviewedAt || submission.grade !== null) && (
                    <Link to={`/student/grades?assignment=${submission.assignmentId}`}>
                      <Button variant="outline" size="sm" className="rounded-xl">
                        عرض الدرجة
                      </Button>
                    </Link>
                  )}
                  {assignment && assignment.maxSubmissions > 1 && (
                    <Link to={`/student/upload?assignment=${assignment.id}`}>
                      <Button size="sm" className="rounded-xl">
                        إعادة التسليم
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {submissions.length === 0 && (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
          <p>لا توجد تسليمات حتى الآن.</p>
          <Link to="/student/upload" className="mt-4 inline-flex">
            <Button className="rounded-xl">رفع تكليف</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
