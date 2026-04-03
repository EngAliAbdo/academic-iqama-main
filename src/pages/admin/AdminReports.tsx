import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Download, FileSearch, Search } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { downloadCsvFile } from "@/lib/report-export";
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

type AdminCaseFilter = "all" | "high" | "medium" | "manual" | "pending" | "failed";

function parseCaseFilter(value: string | null): AdminCaseFilter {
  if (
    value === "high"
    || value === "medium"
    || value === "manual"
    || value === "pending"
    || value === "failed"
  ) {
    return value;
  }

  return "all";
}

function getRiskClass(riskLevel: ReturnType<typeof getOriginalityRiskLevel>) {
  return {
    high: "bg-destructive/10 text-destructive",
    medium: "bg-warning/10 text-warning",
    low: "bg-success/10 text-success",
    manual: "bg-warning/10 text-warning",
    pending: "bg-primary/10 text-primary",
  }[riskLevel];
}

const CHART_COLORS = ["hsl(0,72%,51%)", "hsl(38,92%,50%)", "hsl(215,80%,55%)", "hsl(142,71%,45%)"];

function resolveCurrentStudentName(
  submission: {
    studentId: string;
    academicId: string;
    studentName: string;
  },
  userById: Map<string, { fullName: string }>,
  studentByAcademicId: Map<string, { fullName: string }>,
) {
  return userById.get(submission.studentId)?.fullName
    ?? studentByAcademicId.get(submission.academicId)?.fullName
    ?? submission.studentName
    ?? "حساب محذوف";
}

function resolveCurrentTeacherName(
  assignment: {
    teacherId: string;
    teacherName: string;
  } | undefined,
  userById: Map<string, { fullName: string }>,
) {
  if (!assignment) {
    return "-";
  }

  return userById.get(assignment.teacherId)?.fullName
    ?? assignment.teacherName
    ?? "حساب محذوف";
}

function resolveCurrentMatchedStudentName(
  match: {
    matchedStudentId: string | null;
    matchedStudentName: string;
  },
  userById: Map<string, { fullName: string }>,
) {
  return (match.matchedStudentId ? userById.get(match.matchedStudentId)?.fullName : null)
    ?? match.matchedStudentName
    ?? "حساب محذوف";
}

export default function AdminReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<AdminCaseFilter>(parseCaseFilter(searchParams.get("filter")));
  const { directoryUsers } = useAuth();
  const {
    assignments,
    submissions,
    getLatestOriginalityCheckBySubmissionId,
    getSubmissionMatches,
  } = useAcademicData();

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setFilter(parseCaseFilter(searchParams.get("filter")));
  }, [searchParams]);

  const userById = useMemo(
    () => new Map(directoryUsers.map((user) => [user.id, user])),
    [directoryUsers],
  );

  const studentByAcademicId = useMemo(
    () => new Map(directoryUsers.map((user) => [user.academicId, user])),
    [directoryUsers],
  );

  const updateSearchState = (nextFilter: AdminCaseFilter, nextQuery: string) => {
    const params = new URLSearchParams(searchParams);

    if (nextFilter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", nextFilter);
    }

    const normalizedQuery = nextQuery.trim();
    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    } else {
      params.delete("q");
    }

    setSearchParams(params, { replace: true });
  };

  const caseItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return submissions
      .map((submission) => {
        const assignment = assignments.find((item) => item.id === submission.assignmentId);
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
          resolveCurrentStudentName(submission, userById, studentByAcademicId),
          submission.academicId,
          assignment?.title ?? "",
          assignment?.subject ?? "",
          resolveCurrentTeacherName(assignment, userById),
          check?.summaryForAdmin ?? "",
          matches.map((match) => resolveCurrentMatchedStudentName(match, userById)).join(" "),
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
    assignments,
    filter,
    getLatestOriginalityCheckBySubmissionId,
    getSubmissionMatches,
    query,
    submissions,
    studentByAcademicId,
    userById,
  ]);

  const metrics = useMemo(() => {
    const highRisk = submissions.filter((submission) => getOriginalityRiskLevel(submission) === "high").length;
    const mediumRisk = submissions.filter((submission) =>
      getOriginalityRiskLevel(submission) === "medium" && isSuspiciousSubmission(submission)
    ).length;
    const pendingAnalysis = submissions.filter((submission) =>
      isAnalysisPending(submission.analysisStatus)
    ).length;
    const manualReview = submissions.filter((submission) =>
      submission.analysisStatus === "manual_review_required"
    ).length;
    const failedAnalysis = submissions.filter((submission) =>
      submission.analysisStatus === "failed"
    ).length;

    return { highRisk, mediumRisk, pendingAnalysis, manualReview, failedAnalysis };
  }, [submissions]);

  const riskDistribution = useMemo(
    () => [
      { name: "مرتفعة", value: metrics.highRisk },
      { name: "متوسطة", value: metrics.mediumRisk },
      { name: "يدوية", value: metrics.manualReview },
      { name: "فشل التحليل", value: metrics.failedAnalysis },
      { name: "قيد التحليل", value: metrics.pendingAnalysis },
    ].filter((item) => item.value > 0),
    [metrics],
  );

  const subjectDistribution = useMemo(() => {
    const map = new Map<string, number>();

    caseItems.forEach(({ assignment }) => {
      const subject = assignment?.subject ?? "غير محدد";
      map.set(subject, (map.get(subject) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .map(([subject, count]) => ({ subject, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }, [caseItems]);

  const exportHeaders = [
    "الطالب",
    "الرقم الأكاديمي",
    "المادة",
    "التكليف",
    "المعلم",
    "تاريخ الرفع",
    "حالة التحليل",
    "الأصالة",
    "التشابه",
    "مستوى الخطورة",
    "الحالة",
    "عدد التطابقات",
    "سبب الفشل",
  ];

  const exportRows = useMemo(
    () => caseItems.map(({ submission, assignment, check, matches, riskLevel }) => ([
      resolveCurrentStudentName(submission, userById, studentByAcademicId),
      submission.academicId,
      assignment?.subject ?? "-",
      assignment?.title ?? "-",
      resolveCurrentTeacherName(assignment, userById),
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
    [caseItems, studentByAcademicId, userById],
  );

  const handleFilterChange = (nextFilter: AdminCaseFilter) => {
    setFilter(nextFilter);
    updateSearchState(nextFilter, query);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    updateSearchState(filter, value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-h1 font-bold">قضايا الأصالة والتحليلات المؤسسية</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            متابعة الحالات المشتبهة والتحليلات المعلقة والمواد الأكثر تأثرًا على مستوى النظام.
          </p>
        </div>

        <Button
          variant="outline"
          className="gap-2 rounded-xl"
          disabled={exportRows.length === 0}
          onClick={() => downloadCsvFile("admin-originality-cases.csv", exportHeaders, exportRows)}
        >
          <Download className="h-4 w-4" /> تصدير
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard title="خطورة مرتفعة" value={metrics.highRisk} icon={AlertTriangle} onClick={() => handleFilterChange("high")} active={filter === "high"} />
        <StatCard title="خطورة متوسطة" value={metrics.mediumRisk} icon={FileSearch} onClick={() => handleFilterChange("medium")} active={filter === "medium"} />
        <StatCard title="قيد التحليل" value={metrics.pendingAnalysis} icon={Search} onClick={() => handleFilterChange("pending")} active={filter === "pending"} />
        <StatCard title="مراجعة يدوية" value={metrics.manualReview} icon={AlertTriangle} onClick={() => handleFilterChange("manual")} active={filter === "manual"} />
        <StatCard title="فشل التحليل" value={metrics.failedAnalysis} icon={AlertTriangle} onClick={() => handleFilterChange("failed")} active={filter === "failed"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="mb-4 font-semibold">توزيع مستويات الخطورة</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={riskDistribution}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {riskDistribution.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="mb-4 font-semibold">المواد الأكثر تأثرًا</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={subjectDistribution}>
              <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(215,80%,55%)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ابحث بالطالب أو المادة أو اسم المعلم..."
              className="h-10 rounded-xl pr-9"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
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
                onClick={() => handleFilterChange(item.key as AdminCaseFilter)}
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
                <th className="hidden p-3 text-right font-medium text-muted-foreground lg:table-cell">المادة / التكليف</th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground md:table-cell">المعلم</th>
                <th className="p-3 text-right font-medium text-muted-foreground">التاريخ</th>
                <th className="p-3 text-right font-medium text-muted-foreground">التحليل</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الأصالة</th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground lg:table-cell">التطابقات</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الخطورة</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الحالة</th>
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
                      <p className="font-medium">{resolveCurrentStudentName(submission, userById, studentByAcademicId)}</p>
                      <p className="text-xs text-muted-foreground">{submission.academicId}</p>
                    </div>
                  </td>
                  <td className="hidden p-3 lg:table-cell">
                    <div>
                      <p className="font-medium">{assignment?.subject ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{assignment?.title ?? "-"}</p>
                    </div>
                  </td>
                  <td className="hidden p-3 text-muted-foreground md:table-cell">{resolveCurrentTeacherName(assignment, userById)}</td>
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
