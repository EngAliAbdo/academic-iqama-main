import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Download, Eye, FileSearch, Info, Search } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { downloadCsvFile, openPrintWindow } from "@/lib/report-export";
import {
  formatAnalysisDuration,
  formatDateTimeLabel,
  formatDateLabel,
  getOriginalityRecommendedStatusLabel,
  getOriginalityRiskLabel,
  getOriginalityRiskLevel,
  getSubmissionAttentionPriority,
  getSubmissionAnalysisStatusLabel,
  getSubmissionBadgeVariant,
  isAnalysisPending,
  isSuspiciousSubmission,
} from "@/lib/academic-data";

type TeacherCaseFilter = "all" | "high" | "medium" | "manual" | "pending" | "failed";

function getRiskClass(riskLevel: ReturnType<typeof getOriginalityRiskLevel>) {
  return {
    high: "bg-destructive/10 text-destructive",
    medium: "bg-warning/10 text-warning",
    low: "bg-success/10 text-success",
    manual: "bg-warning/10 text-warning",
    pending: "bg-primary/10 text-primary",
  }[riskLevel];
}

export default function TeacherReports() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TeacherCaseFilter>("all");
  const { user } = useAuth();
  const {
    getAssignmentById,
    getLatestOriginalityCheckBySubmissionId,
    getSubmissionMatches,
    getTeacherSubmissions,
  } = useAcademicData();
  const userId = user?.id ?? "";

  const teacherSubmissions = useMemo(
    () => (userId ? getTeacherSubmissions(userId) : []),
    [getTeacherSubmissions, userId],
  );

  const caseItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return teacherSubmissions
      .map((submission) => {
        const assignment = getAssignmentById(submission.assignmentId);
        const riskLevel = getOriginalityRiskLevel(submission);
        const check = getLatestOriginalityCheckBySubmissionId(submission.id);
        const matches = getSubmissionMatches(submission.id);

        return { submission, assignment, check, matches, riskLevel };
      })
      .filter(({ submission, assignment, check, matches, riskLevel }) => {
        const requiresAttention =
          isSuspiciousSubmission(submission)
          || isAnalysisPending(submission.analysisStatus)
          || submission.analysisStatus === "failed";

        if (!requiresAttention) {
          return false;
        }

        if (filter === "failed" && submission.analysisStatus !== "failed") {
          return false;
        }

        if (filter !== "all" && filter !== "failed" && riskLevel !== filter) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return [
          submission.studentName,
          submission.academicId,
          assignment?.title ?? "",
          assignment?.subject ?? "",
          check?.summaryForTeacher ?? "",
          matches.map((match) => match.matchedStudentName).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        const priorityDiff =
          getSubmissionAttentionPriority(right.submission)
          - getSubmissionAttentionPriority(left.submission);

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        const rightTimestamp = right.submission.analysisRequestedAt ?? right.submission.submittedAt;
        const leftTimestamp = left.submission.analysisRequestedAt ?? left.submission.submittedAt;

        return +new Date(rightTimestamp) - +new Date(leftTimestamp);
      });
  }, [
    filter,
    getAssignmentById,
    getLatestOriginalityCheckBySubmissionId,
    getSubmissionMatches,
    query,
    teacherSubmissions,
  ]);

  const metrics = useMemo(() => {
    const highRisk = teacherSubmissions.filter((submission) => getOriginalityRiskLevel(submission) === "high").length;
    const mediumRisk = teacherSubmissions.filter((submission) => {
      return (
        getOriginalityRiskLevel(submission) === "medium"
        && isSuspiciousSubmission(submission)
      );
    }).length;
    const pendingAnalysis = teacherSubmissions.filter((submission) =>
      isAnalysisPending(submission.analysisStatus)
    ).length;
    const manualReview = teacherSubmissions.filter((submission) =>
      submission.analysisStatus === "manual_review_required"
    ).length;
    const failedAnalysis = teacherSubmissions.filter((submission) =>
      submission.analysisStatus === "failed"
    ).length;

    return { highRisk, mediumRisk, pendingAnalysis, manualReview, failedAnalysis };
  }, [teacherSubmissions]);

  const exportHeaders = [
    "الطالب",
    "الرقم الأكاديمي",
    "التكليف",
    "المادة",
    "تاريخ الرفع",
    "حالة التحليل",
    "الأصالة",
    "التشابه",
    "مستوى الخطورة",
    "قرار المراجعة",
    "عدد التطابقات",
    "سبب الفشل",
  ];

  const exportRows = useMemo(
    () => caseItems.map(({ submission, assignment, check, matches, riskLevel }) => ([
      submission.studentName,
      submission.academicId,
      assignment?.title ?? "-",
      assignment?.subject ?? "-",
      formatDateLabel(submission.submittedAt),
      getSubmissionAnalysisStatusLabel(submission.analysisStatus),
      submission.analysisStatus === "completed"
        ? `${check?.originalityScore ?? submission.originality}%`
        : "غير مكتملة",
      submission.analysisStatus === "completed"
        ? `${check?.matchingPercentage ?? Math.max(0, 100 - submission.originality)}%`
        : "-",
      getOriginalityRiskLabel(riskLevel),
      submission.status,
      matches.length,
      submission.analysisError || "",
    ])),
    [caseItems],
  );

  const applyMetricFilter = (nextFilter: TeacherCaseFilter) => {
    setFilter((currentFilter) => (currentFilter === nextFilter ? "all" : nextFilter));
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-h1 font-bold">تقارير الأصالة والقضايا المشبوهة</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            متابعة التسليمات التي تحتاج مراجعة دقيقة أو قراراً أكاديمياً من المعلم.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            disabled={exportRows.length === 0}
            onClick={() => openPrintWindow("تقرير قضايا الأصالة للمعلم", exportHeaders, exportRows)}
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            disabled={exportRows.length === 0}
            onClick={() => downloadCsvFile("teacher-originality-cases.csv", exportHeaders, exportRows)}
          >
            <Download className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          title="خطورة مرتفعة"
          value={metrics.highRisk}
          icon={AlertTriangle}
          onClick={() => applyMetricFilter("high")}
          active={filter === "high"}
        />
        <StatCard
          title="خطورة متوسطة"
          value={metrics.mediumRisk}
          icon={FileSearch}
          onClick={() => applyMetricFilter("medium")}
          active={filter === "medium"}
        />
        <StatCard
          title="قيد التحليل"
          value={metrics.pendingAnalysis}
          icon={Search}
          onClick={() => applyMetricFilter("pending")}
          active={filter === "pending"}
        />
        <StatCard
          title="مراجعة يدوية"
          value={metrics.manualReview}
          icon={Eye}
          onClick={() => applyMetricFilter("manual")}
          active={filter === "manual"}
        />
        <StatCard
          title="فشل التحليل"
          value={metrics.failedAnalysis}
          icon={AlertTriangle}
          onClick={() => applyMetricFilter("failed")}
          active={filter === "failed"}
        />
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">كيف تعمل هذه الصفحة؟</p>
            <p>
              تعرض هذه الشاشة فقط الحالات التي تحتاج متابعة من المعلم: الخطورة المرتفعة أو المتوسطة،
              التحليل الجاري، المراجعة اليدوية، أو فشل التحليل.
            </p>
            <p>
              <span className="font-medium text-foreground">المراجعة اليدوية</span>
              {" "}
              تعني أن النظام لم يستطع إكمال الفحص الآلي، مثل غياب الملف، أو فشل استخراج النص، أو
              قصر النص جدًا، فحوّل التسليم إلى مراجعة بشرية.
            </p>
            <p>
              <span className="font-medium text-foreground">قيد التحليل</span>
              {" "}
              يعني أن الفنكشن بدأت المعالجة وما زالت النتيجة لم تكتمل. أما
              {" "}
              <span className="font-medium text-foreground">فشل التحليل</span>
              {" "}
              فيعني أن المحاولة توقفت بخطأ ويمكن إعادة المحاولة من صندوق التسليمات أو من صفحة
              مراجعة التسليم.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ابحث باسم الطالب أو التكليف أو الرقم الأكاديمي..."
              className="h-10 rounded-xl pr-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "الكل" },
              { key: "high", label: "مرتفعة" },
              { key: "medium", label: "متوسطة" },
              { key: "manual", label: "يدوية" },
              { key: "pending", label: "قيد التحليل" },
              { key: "failed", label: "فشل التحليل" },
            ].map((item) => (
              <Button
                key={item.key}
                type="button"
                variant={filter === item.key ? "default" : "outline"}
                className="h-9 rounded-xl text-xs"
                onClick={() => setFilter(item.key as TeacherCaseFilter)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 px-5 text-right font-medium text-muted-foreground">الطالب</th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground md:table-cell">التكليف</th>
                <th className="p-3 text-right font-medium text-muted-foreground">التاريخ</th>
                <th className="p-3 text-right font-medium text-muted-foreground">حالة التحليل</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الأصالة</th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground lg:table-cell">التطابقات</th>
                <th className="p-3 text-right font-medium text-muted-foreground">مستوى الخطورة</th>
                <th className="p-3 text-right font-medium text-muted-foreground">قرار المراجعة</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {caseItems.map(({ submission, assignment, check, matches, riskLevel }) => (
                <tr
                  key={submission.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-muted/50"
                >
                  <td className="p-3 px-5">
                    <div>
                      <p className="font-medium">{submission.studentName}</p>
                      <p className="text-xs text-muted-foreground">{submission.academicId}</p>
                    </div>
                  </td>
                  <td className="hidden p-3 md:table-cell">
                    <div>
                      <p className="font-medium">{assignment?.title ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{assignment?.subject ?? "-"}</p>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground tabular-nums">{formatDateLabel(submission.submittedAt)}</td>
                  <td className="p-3">
                    <div className="space-y-1">
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
                      />
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {submission.analysisRequestedAt
                          ? `${isAnalysisPending(submission.analysisStatus) ? "بدأ" : "آخر محاولة"}: ${formatDateTimeLabel(
                            submission.analysisCompletedAt ?? submission.analysisRequestedAt,
                          )}`
                          : "لم يبدأ بعد"}
                      </p>
                      {submission.analysisRequestedAt && (
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {isAnalysisPending(submission.analysisStatus)
                            ? "المدة الحالية"
                            : "المدة"}
                          :{" "}
                          {formatAnalysisDuration(
                            submission.analysisRequestedAt,
                            submission.analysisCompletedAt,
                          ) ?? "-"}
                        </p>
                      )}
                      {submission.analysisStatus === "failed" && submission.analysisError && (
                        <p className="max-w-56 truncate text-[11px] text-destructive">
                          {submission.analysisError}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    {submission.analysisStatus === "completed" ? (
                      <div>
                        <p className="font-medium tabular-nums">
                          {check?.originalityScore ?? submission.originality}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          تشابه {check?.matchingPercentage ?? Math.max(0, 100 - submission.originality)}%
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">غير مكتملة</span>
                    )}
                  </td>
                  <td className="hidden p-3 lg:table-cell">
                    {check ? (
                      <div>
                        <p className="font-medium">{matches.length}</p>
                        <p className="text-xs text-muted-foreground">
                          {getOriginalityRecommendedStatusLabel(check.recommendedStatus)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRiskClass(riskLevel)}`}>
                      {getOriginalityRiskLabel(riskLevel)}
                    </span>
                  </td>
                  <td className="p-3">
                    <StatusBadge variant={getSubmissionBadgeVariant(submission.status)} />
                  </td>
                  <td className="p-3">
                    <Link to={`/teacher/review?submission=${submission.id}`}>
                      <Button variant="ghost" size="sm" className="gap-1 rounded-lg text-xs">
                        <Eye className="h-3.5 w-3.5" /> مراجعة
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {caseItems.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            لا توجد حالات مطابقة للفلاتر الحالية.
          </div>
        )}
      </div>
    </div>
  );
}
