import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BookOpen, Clock, FileSearch, FileText, Users } from "lucide-react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "@/components/StatCard";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatDurationSeconds,
  getAnalysisDurationSeconds,
  isAnalysisPending,
  isSuspiciousSubmission,
} from "@/lib/academic-data";

function buildActivityData(assignmentsDates: string[], submissionDates: string[]) {
  const today = new Date();

  return Array.from({ length: 6 }).map((_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (5 - index));
    const key = day.toISOString().slice(0, 10);

    return {
      day: new Intl.DateTimeFormat("ar-SA", { weekday: "short" }).format(day),
      assignments: assignmentsDates.filter((value) => value.slice(0, 10) === key).length,
      submissions: submissionDates.filter((value) => value.slice(0, 10) === key).length,
    };
  });
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { directoryUsers } = useAuth();
  const { assignments, submissions, subjects } = useAcademicData();

  const activeSubjectsCount = subjects.filter((subject) => subject.status === "active").length;
  const suspiciousCount = submissions.filter(isSuspiciousSubmission).length;
  const pendingAnalysisCount = submissions.filter((submission) => isAnalysisPending(submission.analysisStatus)).length;
  const failedAnalysis = submissions.filter((submission) => submission.analysisStatus === "failed").length;

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

  const oldestPendingAnalysis = oldestPendingSeconds > 0
    ? formatDurationSeconds(oldestPendingSeconds) ?? "-"
    : "-";

  const rolesDistribution = [
    { label: "طلاب", count: directoryUsers.filter((account) => account.role === "student").length },
    { label: "معلمون", count: directoryUsers.filter((account) => account.role === "teacher").length },
    { label: "مسؤولون", count: directoryUsers.filter((account) => account.role === "admin").length },
  ];

  const activityData = useMemo(
    () =>
      buildActivityData(
        assignments.map((assignment) => assignment.createdAt),
        submissions.map((submission) => submission.submittedAt),
      ),
    [assignments, submissions],
  );

  const maxRoleCount = Math.max(...rolesDistribution.map((role) => role.count), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold">لوحة تحكم الإدارة</h1>
        <p className="mt-1 text-muted-foreground">
          نظرة عامة على النظام وحالة التكليفات والتحليلات المرتبطة بالأصالة.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard
          title="إجمالي المستخدمين"
          value={directoryUsers.length}
          icon={Users}
          onClick={() => navigate("/admin/users")}
        />
        <StatCard
          title="المواد النشطة"
          value={activeSubjectsCount}
          icon={BookOpen}
          onClick={() => navigate("/admin/subjects")}
        />
        <StatCard
          title="التكليفات"
          value={assignments.length}
          icon={FileText}
          onClick={() => navigate("/admin/activity?filter=assignment")}
        />
        <StatCard
          title="حالات مشبوهة"
          value={suspiciousCount}
          icon={AlertTriangle}
          onClick={() => navigate("/admin/reports")}
          trend={failedAnalysis > 0 ? { value: `فشل التحليل ${failedAnalysis}`, positive: false } : undefined}
        />
        <StatCard
          title="تحليل معلق"
          value={pendingAnalysisCount}
          icon={FileSearch}
          onClick={() => navigate("/admin/reports?filter=pending")}
          trend={{
            value: oldestPendingAnalysis === "-" ? "لا توجد تحليلات معلقة" : `أقدمها ${oldestPendingAnalysis}`,
            positive: oldestPendingAnalysis === "-",
          }}
        />
        <StatCard
          title="متوسط التحليل"
          value={averageAnalysisTime}
          icon={Clock}
          onClick={() => navigate("/admin/activity?filter=analysis")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="mb-4 font-semibold">نشاط النظام خلال آخر 6 أيام</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={activityData}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="assignments" stroke="hsl(215,80%,55%)" strokeWidth={2} name="تكليفات" />
              <Line type="monotone" dataKey="submissions" stroke="hsl(180,70%,40%)" strokeWidth={2} name="تسليمات" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="mb-4 font-semibold">توزيع المستخدمين</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rolesDistribution}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, maxRoleCount]} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(215,80%,55%)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
