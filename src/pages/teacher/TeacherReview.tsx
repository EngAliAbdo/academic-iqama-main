import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Hash,
  LoaderCircle,
  RefreshCcw,
  User,
  XCircle,
} from "lucide-react";
import { OriginalityGauge } from "@/components/OriginalityGauge";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  formatAnalysisDuration,
  formatDateTimeLabel,
  getMatchTypeLabel,
  getOriginalityRecommendedStatusLabel,
  getReviewDecisionLabel,
  getSourceScopeLabel,
  getSubmissionAnalysisStatusLabel,
  getSubmissionBadgeVariant,
  isAnalysisPending,
  type ReviewFinalDecision,
} from "@/lib/academic-data";
import {
  createSupabaseSubmissionSignedUrl,
  isSupabaseConfigured,
} from "@/lib/supabase-app";

const REVIEW_DECISIONS: {
  key: ReviewFinalDecision;
  label: string;
  icon: typeof CheckCircle2;
}[] = [
  { key: "accepted", label: "مقبول", icon: CheckCircle2 },
  { key: "revision", label: "يحتاج تعديل", icon: RefreshCcw },
  { key: "rejected", label: "غير مقبول", icon: XCircle },
];

function getInitialDecision(
  decision: ReviewFinalDecision | null | undefined,
  status: string,
): ReviewFinalDecision {
  if (decision) {
    return decision;
  }

  if (status === "accepted" || status === "rejected" || status === "revision") {
    return status;
  }

  return "revision";
}

function isPdfSubmission(fileName: string, fileMimeType: string) {
  if (fileMimeType.toLowerCase() === "application/pdf") {
    return true;
  }

  return fileName.toLowerCase().endsWith(".pdf");
}

export default function TeacherReview() {
  const [searchParams] = useSearchParams();
  const { user, authMode } = useAuth();
  const {
    getAssignmentById,
    getLatestOriginalityCheckBySubmissionId,
    getReviewBySubmissionId,
    getSubmissionById,
    getSubmissionMatches,
    getTeacherSubmissions,
    startSubmissionAnalysis,
    reviewSubmission,
  } = useAcademicData();
  const submissionId = searchParams.get("submission");

  const submission = useMemo(() => {
    if (!user) return undefined;
    if (submissionId) {
      return getSubmissionById(submissionId);
    }
    return getTeacherSubmissions(user.id)[0];
  }, [getSubmissionById, getTeacherSubmissions, submissionId, user]);

  const assignment = submission ? getAssignmentById(submission.assignmentId) : undefined;
  const originalityCheck = submission ? getLatestOriginalityCheckBySubmissionId(submission.id) : undefined;
  const review = submission ? getReviewBySubmissionId(submission.id) : undefined;
  const submissionMatches = submission ? getSubmissionMatches(submission.id) : [];
  const canDownloadSubmission =
    authMode === "supabase" && isSupabaseConfigured() && Boolean(submission?.filePath);
  const canInlinePreviewSubmission = submission
    ? canDownloadSubmission && isPdfSubmission(submission.fileName, submission.fileMimeType)
    : false;
  const canStartAnalysis =
    (submission?.analysisStatus === "pending" && !submission.analysisRequestedAt)
    || submission?.analysisStatus === "failed";
  const [selectedDecision, setSelectedDecision] = useState<ReviewFinalDecision>("revision");
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [downloadingSubmission, setDownloadingSubmission] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [refreshingPreview, setRefreshingPreview] = useState(false);
  const [startingAnalysis, setStartingAnalysis] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!submission) {
      return;
    }

    setSelectedDecision(getInitialDecision(review?.finalDecision, submission.status));
    setGrade(submission.grade !== null ? String(submission.grade) : "");
    setFeedback(review?.comments || submission.feedback);
  }, [review, submission]);

  useEffect(() => {
    let isCancelled = false;

    if (!submission?.filePath || !canInlinePreviewSubmission) {
      setPreviewUrl(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);

    void createSupabaseSubmissionSignedUrl(submission.filePath, 300)
      .then((signedUrl) => {
        if (isCancelled) {
          return;
        }

        if (!signedUrl) {
          setPreviewUrl(null);
          setPreviewError("تعذر تحميل معاينة الملف حالياً. يمكنك تنزيل الملف ومراجعته خارج النظام.");
          return;
        }

        setPreviewUrl(signedUrl);
      })
      .finally(() => {
        if (!isCancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [canInlinePreviewSubmission, submission?.filePath]);

  if (!user) {
    return null;
  }

  if (!submission || !assignment) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
        <h1 className="text-h1 font-bold">لا يوجد تسليم محدد</h1>
        <p className="text-muted-foreground">اختر تسليماً من صندوق التسليمات للمتابعة.</p>
        <Link to="/teacher/submissions">
          <Button className="rounded-xl">العودة إلى صندوق التسليمات</Button>
        </Link>
      </div>
    );
  }

  const handleSave = async () => {
    const numericGrade = grade.trim() ? Number(grade) : null;
    if (
      numericGrade !== null &&
      (Number.isNaN(numericGrade) || numericGrade < 0 || numericGrade > 100)
    ) {
      toast({
        title: "الدرجة غير صحيحة",
        description: "أدخل درجة بين 0 و100.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const result = await reviewSubmission({
        submissionId: submission.id,
        finalDecision: selectedDecision,
        grade: numericGrade,
        feedback,
      });

      if (!result) {
        toast({
          title: "تعذر حفظ المراجعة",
          description: "حدث خطأ أثناء تحديث قرار المعلم.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "تم حفظ المراجعة",
        description: `القرار الحالي: ${getReviewDecisionLabel(selectedDecision)}.`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadSubmission = async () => {
    if (!submission.filePath || !canDownloadSubmission) {
      toast({
        title: "الملف غير متاح للتنزيل",
        description: "هذه النسخة محفوظة محلياً فقط أو لم يتم رفعها إلى التخزين السحابي بعد.",
        variant: "destructive",
      });
      return;
    }

    setDownloadingSubmission(true);

    try {
      const signedUrl = await createSupabaseSubmissionSignedUrl(submission.filePath);
      if (!signedUrl) {
        toast({
          title: "تعذر تجهيز رابط الملف",
          description: "حدث خطأ أثناء إنشاء رابط تنزيل مؤقت لهذا التسليم.",
          variant: "destructive",
        });
        return;
      }

      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingSubmission(false);
    }
  };

  const handleRefreshPreview = async () => {
    if (!submission.filePath || !canInlinePreviewSubmission) {
      return;
    }

    setRefreshingPreview(true);
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const signedUrl = await createSupabaseSubmissionSignedUrl(submission.filePath, 300);
      if (!signedUrl) {
        const message = "تعذر تحديث رابط المعاينة حالياً. يمكنك فتح الملف في تبويب جديد.";
        setPreviewUrl(null);
        setPreviewError(message);
        toast({
          title: "تعذر تحديث المعاينة",
          description: message,
          variant: "destructive",
        });
        return;
      }

      setPreviewUrl(signedUrl);
      toast({
        title: "تم تحديث المعاينة",
        description: "أُعيد إنشاء الرابط المؤقت لملف PDF داخل الصفحة.",
      });
    } finally {
      setRefreshingPreview(false);
      setPreviewLoading(false);
    }
  };

  const handleOpenPreviewInNewTab = async () => {
    if (!canDownloadSubmission) {
      toast({
        title: "الملف غير متاح",
        description: "هذه النسخة لم تُرفع إلى التخزين السحابي بعد.",
        variant: "destructive",
      });
      return;
    }

    if (previewUrl && canInlinePreviewSubmission) {
      window.open(previewUrl, "_blank", "noopener,noreferrer");
      return;
    }

    await handleDownloadSubmission();
  };

  const handleStartAnalysis = async () => {
    setStartingAnalysis(true);

    try {
      const result = await startSubmissionAnalysis(submission.id);
      if (!result.submission) {
        toast({
          title: "تعذر تشغيل التحليل",
          description: result.error ?? "حدث خطأ أثناء بدء تحليل الأصالة لهذه النسخة.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title:
          result.submission.analysisStatus === "completed"
            ? "تم تحديث نتيجة الأصالة"
            : "تم بدء التحليل",
        description:
          result.submission.analysisStatus === "completed"
            ? "تم حفظ النتيجة الجديدة لهذه النسخة."
            : "سيجري تحديث حالة التحليل تلقائياً عند اكتمال المعالجة.",
      });
    } finally {
      setStartingAnalysis(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="min-w-0">
        <h1 className="text-h1 font-bold">مراجعة التسليم</h1>
        <p className="mt-1 break-words text-sm text-muted-foreground">
          {assignment.title} - {submission.studentName}
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[22rem_minmax(0,1.2fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl bg-card p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold">معلومات الطالب</h2>
              <StatusBadge variant={getSubmissionBadgeVariant(submission.status)} />
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">الاسم</p>
                  <p className="break-words font-medium">{submission.studentName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">الرقم الأكاديمي</p>
                  <p className="font-medium tabular-nums">{submission.academicId}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">تاريخ التسليم</p>
                  <p className="font-medium tabular-nums">{formatDateTimeLabel(submission.submittedAt)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">الملف</p>
                  <p className="break-all font-medium">{submission.fileName}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card p-6 text-center shadow-card">
            <h2 className="mb-4 font-semibold">نتيجة الأصالة</h2>

            {submission.analysisStatus === "completed" ? (
              <>
                <OriginalityGauge
                  score={originalityCheck?.originalityScore ?? submission.originality}
                  size="md"
                />
              <div className="mt-4 grid gap-3 text-right text-sm">
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
                    <span className="text-muted-foreground">التشابه</span>
                    <span className="font-semibold tabular-nums">
                      {originalityCheck?.matchingPercentage ?? Math.max(0, 100 - submission.originality)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
                    <span className="text-muted-foreground">الثقة</span>
                    <span className="font-semibold tabular-nums">
                      {originalityCheck?.confidenceScore ?? "-"}
                      {originalityCheck ? "%" : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
                    <span className="text-muted-foreground">توصية التحليل</span>
                    <span className="font-semibold">
                      {originalityCheck
                        ? getOriginalityRecommendedStatusLabel(originalityCheck.recommendedStatus)
                        : "-"}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {getSubmissionAnalysisStatusLabel(submission.analysisStatus)}
                </p>
              </>
            ) : isAnalysisPending(submission.analysisStatus) ? (
              <div className="space-y-3 py-4">
                <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">التحليل قيد التنفيذ</p>
                <p className="text-xs text-muted-foreground">
                  يتم فحص الملف حالياً وستظهر نتيجة الأصالة هنا عند اكتمال المعالجة.
                </p>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
                <p className="text-sm font-medium">
                  {getSubmissionAnalysisStatusLabel(submission.analysisStatus)}
                </p>
                <p className="text-xs text-muted-foreground">
                  لا توجد نتيجة مكتملة لهذه النسخة بعد، ويمكن متابعة المراجعة اليدوية عند الحاجة.
                </p>
              </div>
            )}

            <div className="mt-4 grid gap-3 text-right text-sm">
              <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
                <span className="text-muted-foreground">حالة التحليل</span>
                <span className="font-semibold">
                  {getSubmissionAnalysisStatusLabel(submission.analysisStatus)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
                <span className="text-muted-foreground">طلب التحليل</span>
                <span className="font-semibold tabular-nums">
                  {submission.analysisRequestedAt
                    ? formatDateTimeLabel(submission.analysisRequestedAt)
                    : "لم يبدأ بعد"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
                <span className="text-muted-foreground">
                  {submission.analysisStatus === "completed"
                    ? "اكتمل التحليل"
                    : submission.analysisStatus === "failed"
                      || submission.analysisStatus === "manual_review_required"
                      ? "آخر محاولة"
                      : "آخر تحديث"}
                </span>
                <span className="font-semibold tabular-nums">
                  {submission.analysisCompletedAt
                    ? formatDateTimeLabel(submission.analysisCompletedAt)
                    : submission.analysisRequestedAt
                      ? formatDateTimeLabel(submission.analysisRequestedAt)
                      : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
                <span className="text-muted-foreground">
                  {submission.analysisStatus === "completed"
                    ? "مدة التحليل"
                    : submission.analysisStatus === "failed"
                      || submission.analysisStatus === "manual_review_required"
                      ? "مدة آخر محاولة"
                      : isAnalysisPending(submission.analysisStatus)
                        ? "المدة الحالية"
                        : "مدة التحليل"}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatAnalysisDuration(
                    submission.analysisRequestedAt,
                    submission.analysisCompletedAt,
                  ) ?? "-"}
                </span>
                </div>
              </div>

              {submission.analysisStatus === "completed" && originalityCheck && (
                <p className="mt-4 rounded-xl bg-muted/50 p-3 text-right text-xs leading-6 text-muted-foreground">
                  ارتفاع الأصالة الكلية لا يعني براءة النسخة تلقائياً. إذا وُجدت مقاطع حرفية
                  مركزة أو تطابقات داخلية قوية فقد يوصي النظام بالمراجعة حتى لو كانت النسبة
                  العامة مرتفعة.
                </p>
              )}

              {(submission.analysisStatus === "manual_review_required"
                || submission.analysisStatus === "failed"
              || canStartAnalysis) && (
              <div className="mt-4 space-y-3 text-right">
                {(submission.analysisStatus === "manual_review_required"
                  || submission.analysisStatus === "failed") && (
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
                    <p className="font-medium text-foreground">
                      {submission.analysisStatus === "manual_review_required"
                        ? "سبب التحويل إلى المراجعة اليدوية"
                        : "سبب فشل التحليل"}
                    </p>
                    <p className="mt-2 leading-7 text-muted-foreground">
                      {submission.analysisError
                        || (submission.analysisStatus === "manual_review_required"
                          ? "تعذر استخراج النص من الملف أو لم تكتمل شروط التحليل الآلي لهذه النسخة."
                          : "حدثت مشكلة أثناء تنفيذ تحليل الأصالة لهذه النسخة.")}
                    </p>
                  </div>
                )}

                {canStartAnalysis && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl"
                    disabled={startingAnalysis}
                    onClick={() => {
                      void handleStartAnalysis();
                    }}
                  >
                    {startingAnalysis ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-4 w-4" />
                    )}
                    {submission.analysisStatus === "failed" ? "إعادة التحليل" : "بدء التحليل"}
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-card p-6 shadow-card">
            <h2 className="mb-4 font-semibold">سجل المراجعة</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">القرار الحالي</span>
                <span className="font-medium">{getReviewDecisionLabel(review?.finalDecision ?? null)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">آخر مراجعة</span>
                <span className="font-medium tabular-nums">
                  {review?.reviewedAt ? formatDateTimeLabel(review.reviewedAt) : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">الدرجة الحالية</span>
                <span className="font-medium tabular-nums">
                  {submission.grade !== null ? `${submission.grade}/100` : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl bg-card p-6 shadow-card">
            <h2 className="mb-4 font-semibold">معاينة المستند</h2>
            {canInlinePreviewSubmission && (
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all text-sm font-medium text-foreground">{submission.fileName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    معاينة مباشرة لملف PDF داخل النظام.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={refreshingPreview || previewLoading}
                    onClick={() => {
                      void handleRefreshPreview();
                    }}
                  >
                    {refreshingPreview || previewLoading ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-4 w-4" />
                    )}
                    تحديث المعاينة
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={!canDownloadSubmission}
                    onClick={() => {
                      void handleOpenPreviewInNewTab();
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    فتح في تبويب جديد
                  </Button>
                </div>
              </div>
            )}
            {canInlinePreviewSubmission ? (
              previewLoading ? (
                <div className="flex h-96 items-center justify-center rounded-xl border border-border bg-muted/40">
                  <div className="text-center text-muted-foreground">
                    <LoaderCircle className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-foreground">جارٍ تجهيز معاينة الملف</p>
                    <p className="mt-1 text-xs">يتم إنشاء رابط مؤقت وآمن لعرض الملف داخل الصفحة.</p>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="overflow-hidden rounded-xl border border-border bg-background">
                  <iframe
                    title={`معاينة ${submission.fileName}`}
                    src={previewUrl}
                    className="h-[32rem] w-full"
                  />
                </div>
              ) : (
                <div className="flex h-96 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 p-6 text-center">
                  <div className="text-warning">
                    <AlertTriangle className="mx-auto mb-3 h-8 w-8" />
                    <p className="text-sm font-medium">تعذر عرض المعاينة داخل الصفحة</p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">
                      {previewError ?? "يمكنك تنزيل الملف ومتابعة المراجعة خارج النظام."}
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex h-96 items-center justify-center rounded-xl bg-muted">
              <div className="text-center text-muted-foreground">
                <FileText className="mx-auto mb-3 h-12 w-12" />
                <p className="text-sm">المستند المرفوع جاهز للمراجعة</p>
                <p className="mt-1 text-xs">{submission.fileName}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-lg"
                  disabled={downloadingSubmission || !canDownloadSubmission}
                  onClick={() => {
                    void handleDownloadSubmission();
                  }}
                >
                  {downloadingSubmission ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  تنزيل الملف
                </Button>
                {!canDownloadSubmission && (
                  <p className="mt-3 text-xs">
                    يتطلب تنزيل ملف التسليم تفعيل Supabase ووجود نسخة مرفوعة في التخزين السحابي.
                  </p>
                )}
                {submission.notes && (
                  <p className="mx-auto mt-4 max-w-xs rounded-xl bg-background p-3 text-right text-xs leading-6">
                    {submission.notes}
                  </p>
                )}
              </div>
            </div>
            )}
            {canInlinePreviewSubmission && submission.notes && (
              <p className="mt-4 rounded-xl bg-muted/60 p-3 text-right text-xs leading-6 text-muted-foreground">
                {submission.notes}
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-card p-6 shadow-card">
            <h2 className="mb-4 font-semibold">تقرير التحليل التفصيلي</h2>

            {originalityCheck ? (
              <div className="space-y-5">
                <ScrollArea className="max-h-40 rounded-xl bg-muted/60 p-4 text-sm leading-7 text-muted-foreground">
                  <div className="pl-3">{originalityCheck.summaryForTeacher}</div>
                </ScrollArea>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl bg-muted/60 p-4">
                    <p className="text-muted-foreground">نموذج التحليل</p>
                    <p className="mt-1 font-semibold">{originalityCheck.modelName}</p>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-4">
                    <p className="text-muted-foreground">تاريخ التحليل</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {originalityCheck.analyzedAt ? formatDateTimeLabel(originalityCheck.analyzedAt) : "-"}
                    </p>
                  </div>
                </div>

                <Tabs
                  defaultValue={originalityCheck.suspiciousSections.length > 0 ? "sections" : "matches"}
                  className="space-y-4"
                >
                  <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl bg-muted/60 p-1">
                    <TabsTrigger value="sections" className="rounded-lg">
                      المقاطع المشبوهة ({originalityCheck.suspiciousSections.length})
                    </TabsTrigger>
                    <TabsTrigger value="matches" className="rounded-lg">
                      أعلى التطابقات ({submissionMatches.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="sections" className="mt-0">
                    {originalityCheck.suspiciousSections.length > 0 ? (
                      <ScrollArea className="max-h-[38rem] rounded-xl border border-border">
                        <div className="grid gap-3 p-4 xl:grid-cols-2">
                          {originalityCheck.suspiciousSections.map((section, index) => (
                            <div
                              key={`${section.matchedReferenceId}-${index}`}
                              className="rounded-xl border border-border bg-background p-4"
                            >
                              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                <span className="rounded-full bg-warning/10 px-2.5 py-1 text-warning">
                                  {getMatchTypeLabel(section.matchType)}
                                </span>
                                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                                  {section.similarityScore}%
                                </span>
                              </div>
                              <p className="max-h-56 overflow-y-auto text-sm leading-7">{section.sectionText}</p>
                              <p className="mt-3 text-xs leading-6 text-muted-foreground">{section.reason}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-muted-foreground">لا توجد مقاطع مشبوهة مسجلة لهذه النسخة.</p>
                    )}
                  </TabsContent>

                  <TabsContent value="matches" className="mt-0">
                    {submissionMatches.length > 0 ? (
                      <ScrollArea className="max-h-[38rem] rounded-xl border border-border">
                        <div className="grid gap-3 p-4 xl:grid-cols-2">
                          {submissionMatches.map((match) => (
                            <div key={match.id} className="rounded-xl border border-border bg-background p-4">
                              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">
                                  {match.similarityScore}%
                                </span>
                                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                                  {getMatchTypeLabel(match.matchType)}
                                </span>
                                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                                  {getSourceScopeLabel(match.sourceScope)}
                                </span>
                              </div>
                              <p className="break-words text-sm font-medium">
                                {match.matchedStudentName || "طالب غير محدد"}
                              </p>
                              <p className="mt-3 max-h-56 overflow-y-auto text-xs leading-6 text-muted-foreground">
                                {match.matchedExcerpt}
                              </p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-muted-foreground">لا توجد تطابقات داخلية محفوظة لهذه النسخة.</p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                لا يوجد تقرير أصالة تفصيلي محفوظ لهذه النسخة حتى الآن.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24">
          <div className="space-y-5 rounded-2xl bg-card p-6 shadow-card">
            <h2 className="font-semibold">قرار المعلم وملاحظاته</h2>

            <div className="space-y-2">
              <Label>القرار النهائي</Label>
              <div className="grid gap-2">
                {REVIEW_DECISIONS.map((decision) => (
                  <Button
                    key={decision.key}
                    type="button"
                    variant={selectedDecision === decision.key ? "default" : "outline"}
                    className="h-10 justify-start gap-2 rounded-xl text-sm"
                    onClick={() => setSelectedDecision(decision.key)}
                  >
                    <decision.icon className="h-4 w-4" />
                    {decision.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>الدرجة</Label>
              <Input
                type="number"
                placeholder="من 100"
                className="h-11 rounded-xl"
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>ملاحظات المعلم</Label>
              <Textarea
                placeholder="أضف ملاحظاتك وتوصياتك للطالب..."
                className="min-h-[160px] rounded-xl"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
              />
            </div>
          </div>

          <Button
            className="h-11 w-full rounded-xl shadow-button"
            disabled={saving}
            onClick={() => {
              void handleSave();
            }}
          >
            {saving ? "جارٍ حفظ المراجعة..." : "حفظ قرار المعلم"}
          </Button>
        </div>
      </div>
    </div>
  );
}
