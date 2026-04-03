import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  FilePlus,
  FileSearch,
  FileText,
  Inbox,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatDurationSeconds,
  getAnalysisDurationSeconds,
  getOriginalityRiskLevel,
  isAnalysisPending,
  isSuspiciousSubmission,
} from "@/lib/academic-data";

function shortenText(value: string, maxLength = 34) {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength)}...`;
}

function buildWeeklyChart(submittedAtValues: string[]) {
  const today = new Date();
  return Array.from({ length: 6 }).map((_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (5 - index));
    const key = day.toISOString().slice(0, 10);
    const count = submittedAtValues.filter((value) => value.slice(0, 10) === key).length;
    return {
      name: new Intl.DateTimeFormat("ar-SA", { weekday: "short" }).format(day),
      submissions: count,
    };
  });
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getAssignmentById, getTeacherAssignments, getTeacherSubmissions } = useAcademicData();
  const userId = user?.id ?? "";
  const assignments = getTeacherAssignments(userId);
  const submissions = getTeacherSubmissions(userId);
  const chartData = useMemo(
    () => buildWeeklyChart(submissions.map((submission) => submission.submittedAt)),
    [submissions],
  );

  if (!user) {
    return null;
  }

  const activeAssignments = assignments.filter((assignment) => assignment.status === "published").length;
  const pendingReviews = submissions.filter((submission) =>
    ["submitted", "review", "flagged", "revision"].includes(submission.status)
    || isAnalysisPending(submission.analysisStatus)
  ).length;
  const todaySubmissions = submissions.filter(
    (submission) => submission.submittedAt.slice(0, 10) === new Date().toISOString().slice(0, 10),
  ).length;
  const suspiciousCases = submissions.filter(isSuspiciousSubmission).length;
  const pendingAnalysis = submissions.filter((submission) => isAnalysisPending(submission.analysisStatus)).length;
  const failedAnalysis = submissions.filter((submission) => submission.analysisStatus === "failed").length;
  const completedReviews = submissions.filter((submission) => submission.grade !== null).length;
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
  const oldestPendingAnalysis = oldestPendingSeconds > 0 ? formatDurationSeconds(oldestPendingSeconds) ?? "-" : "-";

  const recentActivity = submissions
    .slice()
    .sort((left, right) => +new Date(right.submittedAt) - +new Date(left.submittedAt))
    .slice(0, 5)
    .map((submission) => {
    const assignment = getAssignmentById(submission.assignmentId);
    const riskLevel = getOriginalityRiskLevel(submission);

    return {
      id: submission.id,
      student: submission.studentName,
      assignment: assignment?.title ?? "تكليف",
      time: formatDistanceToNow(new Date(submission.submittedAt), { addSuffix: true, locale: ar }),
      description:
        submission.analysisStatus === "failed"
          ? "فشل تحليل الأصالة ويحتاج إلى إعادة تشغيل أو متابعة تقنية"
          : riskLevel === "high"
          ? "ظهرت حالة عالية الخطورة وتحتاج مراجعة"
          : riskLevel === "manual"
            ? "تم تحويل التسليم إلى مراجعة يدوية"
            : isAnalysisPending(submission.analysisStatus)
              ? "ما زال تحليل الأصالة قيد التنفيذ"
              : "وصل تسليم جديد إلى صندوق المراجعة",
    };
  });

  const teacherDisplayName = shortenText(user.fullName, 28);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold break-words" title={user.fullName}>
          مرحباً، {teacherDisplayName}
        </h1>
        <p className="mt-1 text-muted-foreground">ملخص نشاطك الأكاديمي وإدارة التسليمات وحالات الأصالة الحالية.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/teacher/create-assignment">
          <Button className="gap-2 rounded-xl shadow-button"><FilePlus className="h-4 w-4" /> إنشاء تكليف</Button>
        </Link>
        <Link to="/teacher/submissions">
          <Button variant="outline" className="gap-2 rounded-xl"><Inbox className="h-4 w-4" /> مراجعة التسليمات</Button>
        </Link>
        <Link to="/teacher/reports">
          <Button variant="outline" className="gap-2 rounded-xl"><FileSearch className="h-4 w-4" /> قضايا الأصالة</Button>
        </Link>
        <Link to="/teacher/analytics">
          <Button variant="outline" className="gap-2 rounded-xl"><BarChart3 className="h-4 w-4" /> التحليلات</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard
          title="تكليفات نشطة"
          value={activeAssignments}
          icon={FileText}
          onClick={() => navigate("/teacher/assignments")}
        />
        <StatCard
          title="مراجعات معلقة"
          value={pendingReviews}
          icon={Clock}
          onClick={() => navigate("/teacher/submissions")}
        />
        <StatCard
          title="تسليمات اليوم"
          value={todaySubmissions}
          icon={Inbox}
          onClick={() => navigate("/teacher/submissions")}
        />
        <StatCard
          title="تحليل معلق"
          value={pendingAnalysis}
          icon={FileSearch}
          onClick={() => navigate("/teacher/submissions")}
          trend={{
            value: oldestPendingAnalysis === "-" ? "لا توجد تحليلات معلقة" : `أقدمها ${oldestPendingAnalysis}`,
            positive: oldestPendingAnalysis === "-",
          }}
        />
        <StatCard
          title="خطورة مرتفعة"
          value={suspiciousCases}
          icon={AlertTriangle}
          onClick={() => navigate("/teacher/reports")}
          trend={failedAnalysis > 0 ? { value: `فشل التحليل ${failedAnalysis}`, positive: false } : undefined}
        />
        <StatCard
          title="تقييمات مكتملة"
          value={completedReviews}
          icon={CheckCircle2}
          onClick={() => navigate("/teacher/analytics")}
          trend={{ value: `متوسط التحليل ${averageAnalysisTime}`, positive: averageAnalysisTime !== "-" }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="mb-4 font-semibold">التسليمات خلال آخر 6 أيام</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="submissions" fill="hsl(215, 80%, 55%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-card shadow-card">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold">آخر النشاطات</h2>
          </div>
          <div className="space-y-1 p-3">
            {recentActivity.map((activity) => (
              <Link
                key={activity.id}
                to={`/teacher/review?submission=${activity.id}`}
                className="block rounded-xl p-3 transition-colors hover:bg-muted/50"
              >
                <p className="text-sm">
                  <span className="font-medium" title={activity.student}>
                    {shortenText(activity.student, 22)}
                  </span>{" "}
                  - {activity.description}
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground truncate" title={activity.assignment}>
                    {shortenText(activity.assignment, 36)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{activity.time}</span>
                </div>
              </Link>
            ))}
            {recentActivity.length === 0 && (
              <div className="rounded-xl p-3 text-sm text-muted-foreground">لا توجد تسليمات حديثة حتى الآن.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
