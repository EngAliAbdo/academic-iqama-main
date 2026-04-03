import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  FileSearch,
  FileText,
  Upload,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatDateLabel,
  getOriginalityRiskLevel,
  getStudentAssignmentBadge,
  isAnalysisPending,
} from "@/lib/academic-data";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getAssignmentById, getStudentAssignments, getStudentSubmission, getStudentSubmissions } =
    useAcademicData();

  if (!user) {
    return null;
  }

  const assignments = getStudentAssignments(user.id);
  const submissions = getStudentSubmissions(user.id);
  const pendingAssignments = assignments.filter((assignment) => !getStudentSubmission(user.id, assignment.id));
  const recentSubmissions = submissions.slice(0, 4);
  const upcomingDeadlines = pendingAssignments
    .slice()
    .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
    .slice(0, 3);
  const gradedCount = submissions.filter((submission) => submission.grade !== null).length;
  const pendingAnalysisCount = submissions.filter((submission) => isAnalysisPending(submission.analysisStatus)).length;
  const followUpCount = submissions.filter((submission) => {
    const riskLevel = getOriginalityRiskLevel(submission);
    return riskLevel === "high" || riskLevel === "manual" || submission.status === "revision";
  }).length;

  const rawDisplayName = user.fullName.trim().split(/\s+/)[0] || user.fullName;
  const firstName = rawDisplayName.length > 28 ? `${rawDisplayName.slice(0, 28)}...` : rawDisplayName;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold break-words">
          مرحباً بك، <span title={user.fullName}>{firstName}</span>
        </h1>
        <p className="mt-1 text-muted-foreground">إليك ملخص نشاطك الأكاديمي الحالي ونتائج تسليماتك الأخيرة.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/student/upload">
          <Button className="gap-2 rounded-xl shadow-button"><Upload className="h-4 w-4" /> رفع تكليف</Button>
        </Link>
        <Link to="/student/subjects">
          <Button variant="outline" className="gap-2 rounded-xl"><BookOpen className="h-4 w-4" /> عرض المواد</Button>
        </Link>
        <Link to="/student/assignments">
          <Button variant="outline" className="gap-2 rounded-xl"><Eye className="h-4 w-4" /> حالة التكليفات</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="إجمالي التكليفات"
          value={assignments.length}
          icon={FileText}
          onClick={() => navigate("/student/assignments")}
        />
        <StatCard
          title="بانتظار التسليم"
          value={pendingAssignments.length}
          icon={Clock}
          onClick={() => navigate("/student/upload")}
          trend={{
            value: `الأقرب: ${upcomingDeadlines[0] ? formatDateLabel(upcomingDeadlines[0].dueAt) : "لا يوجد"}`,
            positive: false,
          }}
        />
        <StatCard
          title="قيد التحليل"
          value={pendingAnalysisCount}
          icon={FileSearch}
          onClick={() => navigate("/student/status")}
        />
        <StatCard
          title="نتائج تحتاج متابعة"
          value={followUpCount || gradedCount}
          icon={followUpCount > 0 ? AlertTriangle : CheckCircle2}
          onClick={() => navigate("/student/originality")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl bg-card shadow-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-semibold">آخر التسليمات</h2>
            <Link to="/student/history" className="flex items-center gap-1 text-xs text-primary hover:underline">
              عرض الكل <ArrowLeft className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 px-5 text-right font-medium text-muted-foreground">التكليف</th>
                  <th className="hidden p-3 text-right font-medium text-muted-foreground sm:table-cell">المادة</th>
                  <th className="hidden p-3 text-right font-medium text-muted-foreground md:table-cell">التاريخ</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">الحالة</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">الدرجة</th>
                </tr>
              </thead>
              <tbody>
                {recentSubmissions.map((submission) => {
                  const assignment = getAssignmentById(submission.assignmentId);
                  return (
                    <tr
                      key={submission.id}
                      className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/50"
                      onClick={() => navigate(`/student/status?assignment=${submission.assignmentId}`)}
                    >
                      <td className="p-3 px-5 font-medium">{assignment?.title ?? "تكليف"}</td>
                      <td className="hidden p-3 text-muted-foreground sm:table-cell">{assignment?.subject ?? "-"}</td>
                      <td className="hidden p-3 tabular-nums text-muted-foreground md:table-cell">{formatDateLabel(submission.submittedAt)}</td>
                      <td className="p-3"><StatusBadge variant={submission.status} /></td>
                      <td className="p-3 font-medium tabular-nums">{submission.grade ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-card shadow-card">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold">المواعيد القادمة</h2>
          </div>
          <div className="space-y-1 p-3">
            {upcomingDeadlines.map((assignment) => (
              <button
                key={assignment.id}
                type="button"
                onClick={() => navigate(`/student/upload?assignment=${assignment.id}`)}
                className="w-full rounded-xl p-3 text-right transition-colors hover:bg-muted/50"
              >
                <p className="text-sm font-medium">{assignment.title}</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{assignment.subject}</span>
                  <StatusBadge
                    variant={getStudentAssignmentBadge(assignment)}
                    label={formatDateLabel(assignment.dueAt)}
                  />
                </div>
              </button>
            ))}
            {upcomingDeadlines.length === 0 && (
              <div className="rounded-xl p-3 text-sm text-muted-foreground">لا توجد تكليفات معلقة حالياً.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
