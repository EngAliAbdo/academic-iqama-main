import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
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
import { getSubmissionBadgeVariant } from "@/lib/academic-data";

function shortenAssignmentText(value: string, maxLength = 30) {
  const normalized = value.trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

export default function StudentGrades() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { getAssignmentById, getStudentSubmissions } = useAcademicData();
  const highlightedAssignmentId = searchParams.get("assignment");
  const userId = user?.id ?? "";

  const allGrades = useMemo(() => {
    if (!userId) {
      return [];
    }

    return getStudentSubmissions(userId);
  }, [getStudentSubmissions, userId]);

  const grades = useMemo(() => {
    if (!highlightedAssignmentId) {
      return allGrades;
    }

    const filtered = allGrades.filter((submission) => submission.assignmentId === highlightedAssignmentId);
    return filtered.length > 0 ? filtered : allGrades;
  }, [allGrades, highlightedAssignmentId]);

  if (!user) {
    return null;
  }

  if (allGrades.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
        <h1 className="text-h1 font-bold">لا توجد درجات بعد</h1>
        <p className="text-muted-foreground">
          ارفع أحد التكليفات أولاً حتى تظهر الدرجة وملاحظات المعلم هنا.
        </p>
        <Link to="/student/upload">
          <Button className="rounded-xl">رفع تكليف</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold">الدرجات والتقييم</h1>
        <p className="text-sm text-muted-foreground mt-1">جميع درجاتك وملاحظات المعلمين على التسليمات</p>
      </div>

      {allGrades.length > 1 && (
        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="mb-3 font-semibold">اختر التكليف الذي تريد عرض درجته</h2>
          <Select
            value={highlightedAssignmentId ?? "__all__"}
            onValueChange={(value) => {
              if (value === "__all__") {
                setSearchParams({}, { replace: true });
                return;
              }

              setSearchParams({ assignment: value }, { replace: true });
            }}
          >
            <SelectTrigger className="h-14 rounded-xl text-right">
              <SelectValue placeholder="اختر التكليف" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">عرض جميع الدرجات</SelectItem>
              {allGrades.map((submission) => {
                const assignment = getAssignmentById(submission.assignmentId);
                const label = `${assignment?.subject ?? "مادة"} - ${assignment?.title ?? "تكليف"}`;
                return (
                  <SelectItem key={submission.id} value={submission.assignmentId} title={label}>
                    {`${shortenAssignmentText(assignment?.subject ?? "مادة", 18)} - ${shortenAssignmentText(assignment?.title ?? "تكليف", 24)}`}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-4">
        {grades.map((submission) => {
          const assignment = getAssignmentById(submission.assignmentId);
          return (
            <div key={submission.id} className="bg-card rounded-2xl shadow-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="break-words font-semibold" title={assignment?.title ?? "تكليف"}>
                      {assignment?.title ?? "تكليف"}
                    </h3>
                    <StatusBadge variant={getSubmissionBadgeVariant(submission.status)} />
                  </div>
                  <p className="text-xs text-muted-foreground" title={assignment?.subject ?? "-"}>
                    {assignment?.subject ?? "-"}
                  </p>
                  {submission.feedback && (
                    <p className="text-sm text-muted-foreground mt-3 bg-muted rounded-xl p-3">{submission.feedback}</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link to={`/student/status?assignment=${submission.assignmentId}`}>
                      <Button variant="outline" size="sm" className="rounded-xl">
                        حالة التسليم
                      </Button>
                    </Link>
                    <Link to={`/student/originality?assignment=${submission.assignmentId}`}>
                      <Button variant="outline" size="sm" className="rounded-xl">
                        نتيجة الأصالة
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <OriginalityGauge score={submission.originality} size="sm" />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">الدرجة</p>
                    <p className="text-h2 font-bold tabular-nums">
                      {submission.grade !== null ? `${submission.grade}/100` : "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
