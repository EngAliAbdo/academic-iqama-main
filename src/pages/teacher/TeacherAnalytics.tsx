import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatDurationSeconds,
  getAnalysisDurationSeconds,
  getOriginalityRiskLevel,
  isAnalysisPending,
  isSuspiciousSubmission,
} from "@/lib/academic-data";

const COLORS = [
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(215, 80%, 55%)",
  "hsl(262, 65%, 60%)",
];

function buildSubmissionTrend(submittedAtValues: string[]) {
  const today = new Date();
  return Array.from({ length: 6 }).map((_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (5 - index));
    const key = day.toISOString().slice(0, 10);
    return {
      day: new Intl.DateTimeFormat("ar-SA", { weekday: "short" }).format(day),
      count: submittedAtValues.filter((value) => value.slice(0, 10) === key).length,
    };
  });
}

function buildGradeDistribution(grades: number[]) {
  return [
    { range: "90-100", count: grades.filter((grade) => grade >= 90).length },
    { range: "80-89", count: grades.filter((grade) => grade >= 80 && grade < 90).length },
    { range: "70-79", count: grades.filter((grade) => grade >= 70 && grade < 80).length },
    { range: "60-69", count: grades.filter((grade) => grade >= 60 && grade < 70).length },
    { range: "أقل من 60", count: grades.filter((grade) => grade < 60).length },
  ];
}

export default function TeacherAnalytics() {
  const { user } = useAuth();
  const { getAssignmentById, getTeacherSubmissions } = useAcademicData();
  const userId = user?.id ?? "";

  const submissions = useMemo(
    () => (userId ? getTeacherSubmissions(userId) : []),
    [getTeacherSubmissions, userId],
  );

  const submissionTrend = useMemo(
    () => buildSubmissionTrend(submissions.map((submission) => submission.submittedAt)),
    [submissions],
  );

  const gradeDistribution = useMemo(
    () => buildGradeDistribution(submissions.flatMap((submission) => (submission.grade !== null ? [submission.grade] : []))),
    [submissions],
  );

  const originalityDistribution = useMemo(() => {
    const distribution = [
      { name: "منخفضة الخطورة", value: 0 },
      { name: "متوسطة الخطورة", value: 0 },
      { name: "مرتفعة الخطورة", value: 0 },
      { name: "قيد التحليل", value: 0 },
      { name: "مراجعة يدوية", value: 0 },
    ];

    submissions.forEach((submission) => {
      const riskLevel = getOriginalityRiskLevel(submission);
      const indexByRisk = {
        low: 0,
        medium: 1,
        high: 2,
        pending: 3,
        manual: 4,
      } as const;
      distribution[indexByRisk[riskLevel]].value += 1;
    });

    return distribution.filter((item) => item.value > 0);
  }, [submissions]);

  const metrics = useMemo(() => {
    const gradedSubmissions = submissions.filter((submission) => submission.grade !== null);
    const averageGrade = gradedSubmissions.length > 0
      ? (gradedSubmissions.reduce((total, submission) => total + (submission.grade ?? 0), 0) / gradedSubmissions.length).toFixed(1)
      : "-";

    const onTimeSubmissions = submissions.filter((submission) => {
      const assignment = getAssignmentById(submission.assignmentId);
      return assignment && new Date(submission.submittedAt) <= new Date(assignment.dueAt);
    }).length;

    const lateSubmissions = submissions.filter((submission) => {
      const assignment = getAssignmentById(submission.assignmentId);
      return assignment && new Date(submission.submittedAt) > new Date(assignment.dueAt);
    }).length;

    const analysisDurationsSeconds = submissions
      .map((submission) =>
        getAnalysisDurationSeconds(
          submission.analysisRequestedAt,
          submission.analysisCompletedAt,
        ))
      .filter((value): value is number => value !== null);

    const averageAnalysisTime = analysisDurationsSeconds.length > 0
      ? formatDurationSeconds(
        Math.round(
          analysisDurationsSeconds.reduce((total, value) => total + value, 0)
            / analysisDurationsSeconds.length,
        ),
      ) ?? "-"
      : "-";

    const oldestPendingSeconds = submissions
      .filter((submission) => isAnalysisPending(submission.analysisStatus))
      .map((submission) => getAnalysisDurationSeconds(submission.analysisRequestedAt, null))
      .filter((value): value is number => value !== null)
      .reduce((max, value) => Math.max(max, value), 0);

    const suspiciousCases = submissions.filter(isSuspiciousSubmission).length;
    const pendingAnalysis = submissions.filter((submission) => isAnalysisPending(submission.analysisStatus)).length;

    return {
      averageGrade,
      onTimeRate: submissions.length > 0 ? `${Math.round((onTimeSubmissions / submissions.length) * 100)}%` : "-",
      lateSubmissions,
      averageAnalysisTime,
      oldestPendingAnalysis: oldestPendingSeconds > 0 ? formatDurationSeconds(oldestPendingSeconds) ?? "-" : "-",
      suspiciousCases,
      pendingAnalysis,
    };
  }, [getAssignmentById, submissions]);

  const topAssignments = useMemo(() => {
    const counts = new Map<string, { title: string; count: number }>();

    submissions.forEach((submission) => {
      const assignment = getAssignmentById(submission.assignmentId);
      const title = assignment?.title ?? "تكليف";
      const current = counts.get(submission.assignmentId);
      counts.set(submission.assignmentId, {
        title,
        count: (current?.count ?? 0) + 1,
      });
    });

    return Array.from(counts.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);
  }, [getAssignmentById, submissions]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold">التحليلات</h1>
        <p className="mt-1 text-sm text-muted-foreground">تحليل فعلي لأداء التكليفات والتسليمات وحالات الأصالة الحالية.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="mb-4 font-semibold">اتجاه التسليمات</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={submissionTrend}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="hsl(215, 80%, 55%)" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="mb-4 font-semibold">توزيع الدرجات</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={gradeDistribution}>
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(180, 70%, 40%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="mb-4 font-semibold">توزيع حالات الأصالة</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={originalityDistribution}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {originalityDistribution.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="mb-4 font-semibold">ملخص الأداء</h2>
          <div className="space-y-4">
            {[
              { label: "متوسط الدرجات", value: metrics.averageGrade },
              { label: "معدل التسليم في الوقت", value: metrics.onTimeRate },
              { label: "التسليمات المتأخرة", value: String(metrics.lateSubmissions) },
              { label: "متوسط زمن التحليل", value: metrics.averageAnalysisTime },
              { label: "أقدم تحليل معلق", value: metrics.oldestPendingAnalysis },
              { label: "حالات الخطورة المرتفعة", value: String(metrics.suspiciousCases) },
              { label: "تحليلات معلقة", value: String(metrics.pendingAnalysis) },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-semibold tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-6 shadow-card">
        <h2 className="mb-4 font-semibold">أكثر التكليفات استلاماً</h2>
        <div className="space-y-3">
          {topAssignments.map((item) => (
            <div key={item.title} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
              <span className="text-sm font-medium">{item.title}</span>
              <span className="text-sm tabular-nums text-muted-foreground">{item.count} تسليم</span>
            </div>
          ))}
          {topAssignments.length === 0 && (
            <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              لا توجد بيانات كافية لعرض التحليلات حتى الآن.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
