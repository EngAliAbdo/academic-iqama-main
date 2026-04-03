import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  FileSearch,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { OriginalityGauge } from "@/components/OriginalityGauge";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatDateTimeLabel,
  getOriginalityRiskLabel,
  getOriginalityRiskLevel,
  getReviewDecisionLabel,
  getSubmissionAnalysisStatusLabel,
  getSubmissionBadgeVariant,
  isAnalysisPending,
  type Submission,
} from "@/lib/academic-data";

function shortenAssignmentText(value: string, maxLength = 30) {
  const normalized = value.trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function getSafeSummary(submission: Submission) {
  if (submission.analysisStatus === "pending" && !submission.analysisRequestedAt) {
    return "تم استلام الملف وهو بانتظار بدء التحليل من قبل النظام أو المعلم. ستظهر النتيجة المختصرة هنا بمجرد تشغيل الفحص.";
  }

  if (isAnalysisPending(submission.analysisStatus)) {
    return "تم استلام الملف وبدأت عملية تحليل الأصالة. ستظهر لك النتيجة المختصرة بمجرد اكتمال المعالجة.";
  }

  if (submission.analysisStatus === "manual_review_required") {
    return "تعذر استخراج النص من الملف تلقائياً، لذلك تم تحويل التسليم إلى مراجعة يدوية لدى المعلم.";
  }

  if (submission.analysisStatus === "failed") {
    return "تعذر إكمال تحليل الأصالة لهذه النسخة حالياً. سيواصل المعلم مراجعة التسليم وتحديث حالته.";
  }

  if (submission.originality >= 80) {
    return "تشير النتيجة الحالية إلى أصالة جيدة مع تشابه محدود غير مؤثر في التقييم الأولي.";
  }

  if (submission.originality >= 50) {
    return "تم رصد مستوى تشابه متوسط في بعض الأجزاء، وقد يطلب المعلم توضيحاً أو تعديلاً قبل الاعتماد النهائي.";
  }

  return "تم رصد تشابه مرتفع نسبياً في هذا التسليم، وسيتم مراجعته بشكل تفصيلي من قبل المعلم قبل اتخاذ القرار النهائي.";
}

export default function StudentOriginality() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    getAssignmentById,
    getLatestOriginalityCheckBySubmissionId,
    getReviewBySubmissionId,
    getStudentSubmission,
    getStudentSubmissions,
    isRefreshing,
    persistenceMode,
    refreshAcademicData,
  } = useAcademicData();
  const assignmentId = searchParams.get("assignment");
  const userId = user?.id ?? "";

  const submissions = useMemo(() => {
    if (!userId) {
      return [];
    }

    return getStudentSubmissions(userId);
  }, [getStudentSubmissions, userId]);

  const submission = useMemo(() => {
    if (assignmentId) {
      return getStudentSubmission(userId, assignmentId);
    }

    return submissions[0];
  }, [assignmentId, getStudentSubmission, submissions, userId]);

  const assignment = submission ? getAssignmentById(submission.assignmentId) : undefined;
  const originalityCheck = submission ? getLatestOriginalityCheckBySubmissionId(submission.id) : undefined;
  const review = submission ? getReviewBySubmissionId(submission.id) : undefined;
  const canRefreshRemotely = persistenceMode === "supabase";

  if (!user) {
    return null;
  }

  if (!submission) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
        <h1 className="text-h1 font-bold">لا توجد نتيجة أصالة بعد</h1>
        <p className="text-muted-foreground">
          ارفع أحد التكليفات أولاً حتى يتم إنشاء نتيجة الأصالة الخاصة به.
        </p>
        <Link to="/student/upload">
          <Button className="rounded-xl">رفع تكليف</Button>
        </Link>
      </div>
    );
  }

  const matchingPercentage = originalityCheck?.matchingPercentage ?? Math.max(0, 100 - submission.originality);
  const studentSummary = originalityCheck?.summaryForStudent ?? getSafeSummary(submission);
  const analysisStarted = Boolean(submission.analysisRequestedAt);
  const displayedRiskLabel = originalityCheck
    ? getOriginalityRiskLabel(originalityCheck.riskLevel)
    : getOriginalityRiskLabel(getOriginalityRiskLevel(submission));

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold">نتيجة الأصالة</h1>
        <p className="mt-1 break-words text-sm text-muted-foreground" title={`${assignment?.title ?? "التسليم الحالي"} - ${assignment?.subject ?? "بدون مادة محددة"}`}>
          {assignment?.title ?? "التسليم الحالي"} - {assignment?.subject ?? "بدون مادة محددة"}
        </p>
      </div>

      {submissions.length > 1 && (
        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="mb-3 font-semibold">اختر نتيجة الأصالة التي تريد عرضها</h2>
          <Select
            value={submission.assignmentId}
            onValueChange={(value) => {
              setSearchParams({ assignment: value }, { replace: true });
            }}
          >
            <SelectTrigger className="h-14 rounded-xl text-right">
              <SelectValue placeholder="اختر التكليف" />
            </SelectTrigger>
            <SelectContent>
              {submissions.map((item) => {
                const itemAssignment = getAssignmentById(item.assignmentId);
                const label = `${itemAssignment?.subject ?? "مادة"} - ${itemAssignment?.title ?? "تكليف"}`;
                return (
                  <SelectItem key={item.id} value={item.assignmentId} title={label}>
                    {`${shortenAssignmentText(itemAssignment?.subject ?? "مادة", 18)} - ${shortenAssignmentText(itemAssignment?.title ?? "تكليف", 24)}`}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {canRefreshRemotely && (
        <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {isAnalysisPending(submission.analysisStatus) && analysisStarted
              ? "يتم تحديث نتيجة التحليل تلقائياً كل 15 ثانية أثناء التنفيذ، ويمكنك التحديث الآن إذا أردت."
              : "يمكنك تحديث النتيجة يدوياً لجلب آخر ملخص وملاحظات المراجعة من قاعدة البيانات."}
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

      <div className="rounded-2xl bg-card p-8 shadow-card">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">ملخص التحليل</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              آخر تحديث:{" "}
              {formatDateTimeLabel(
                originalityCheck?.analyzedAt ?? submission.analysisCompletedAt ?? submission.submittedAt,
              )}
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

        {submission.analysisStatus === "completed" && (
          <div className="text-center">
            <OriginalityGauge
              score={originalityCheck?.originalityScore ?? submission.originality}
              size="lg"
              className="mb-6"
            />
            <div className="grid gap-4 text-sm sm:grid-cols-3">
              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="text-muted-foreground">الأصالة</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {originalityCheck?.originalityScore ?? submission.originality}%
                </p>
              </div>
              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="text-muted-foreground">التشابه التقديري</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{matchingPercentage}%</p>
              </div>
              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="text-muted-foreground">مستوى الخطورة</p>
                <p className="mt-1 text-2xl font-bold">
                  {displayedRiskLabel}
                </p>
              </div>
            </div>
          </div>
        )}

        {submission.analysisStatus === "pending" && !analysisStarted && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 rounded-full bg-muted p-4 text-muted-foreground">
              <Clock3 className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">بانتظار بدء التحليل</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              تم حفظ التسليم، لكنه ما زال في قائمة الانتظار حتى يبدأ النظام أو المعلم تشغيل تحليل
              الأصالة.
            </p>
          </div>
        )}

        {isAnalysisPending(submission.analysisStatus) && analysisStarted && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-4 text-primary">
              <LoaderCircle className="h-8 w-8 animate-spin" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">التحليل قيد التنفيذ</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              يتم الآن فحص الملف ومقارنته بالتسليمات الداخلية ذات الصلة. ستظهر النتيجة هنا
              تلقائياً بعد انتهاء المعالجة.
            </p>
          </div>
        )}

        {submission.analysisStatus === "manual_review_required" && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 rounded-full bg-warning/10 p-4 text-warning">
              <FileSearch className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">يتطلب مراجعة يدوية</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              تعذر تحليل النص آلياً من الملف المرفوع، وتم تحويله إلى مراجعة يدوية من قبل المعلم
              أو الإدارة.
            </p>
          </div>
        )}

        {submission.analysisStatus === "failed" && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 rounded-full bg-destructive/10 p-4 text-destructive">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">تعذر إكمال التحليل</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              حدثت مشكلة أثناء تنفيذ تحليل الأصالة لهذه النسخة. سيبقى قرار التقييم بيد المعلم.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-card p-6 shadow-card">
        <h3 className="mb-3 font-semibold">الملخص الآمن للطالب</h3>
        <p className="text-sm leading-7 text-muted-foreground">{studentSummary}</p>
      </div>

      <div className="rounded-2xl bg-card p-6 shadow-card">
        <h3 className="mb-3 font-semibold">ملاحظات المعلم</h3>
        <p className="text-sm leading-7 text-muted-foreground">
          {review?.comments || submission.feedback || "لا توجد ملاحظات إضافية من المعلم حتى الآن."}
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="text-muted-foreground">القرار النهائي</p>
            <p className="mt-1 font-semibold">{getReviewDecisionLabel(review?.finalDecision ?? null)}</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="text-muted-foreground">آخر مراجعة</p>
            <p className="mt-1 font-semibold tabular-nums">
              {review?.reviewedAt ? formatDateTimeLabel(review.reviewedAt) : "-"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link to={`/student/status?assignment=${submission.assignmentId}`}>
          <Button variant="outline" className="rounded-xl">
            حالة التسليم
          </Button>
        </Link>
        <Link to={`/student/grades?assignment=${submission.assignmentId}`}>
          <Button variant="outline" className="gap-2 rounded-xl">
            <ArrowRight className="h-4 w-4" />
            عرض الدرجة
          </Button>
        </Link>
        {assignment && assignment.maxSubmissions > 1 && (
          <Link to={`/student/upload?assignment=${assignment.id}`}>
            <Button className="rounded-xl">إعادة التسليم</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
