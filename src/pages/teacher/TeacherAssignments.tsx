import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Paperclip, Plus, Search } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateLabel } from "@/lib/academic-data";

export default function TeacherAssignments() {
  const [query, setQuery] = useState("");
  const { user } = useAuth();
  const { getTeacherAssignments, getTeacherSubmissions } = useAcademicData();
  const userId = user?.id ?? "";
  const teacherAssignments = getTeacherAssignments(userId);
  const teacherSubmissions = getTeacherSubmissions(userId);
  const assignments = useMemo(() => {
    if (!userId) return [];
    const normalizedQuery = query.trim().toLowerCase();

    return teacherAssignments.filter((assignment) => {
      if (!normalizedQuery) return true;
      return [assignment.title, assignment.subject, assignment.level]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, teacherAssignments, userId]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-h1 font-bold">إدارة التكليفات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            جميع التكليفات التي أنشأتها مع حالة التسليمات والمرفقات.
          </p>
        </div>
        <Link to="/teacher/create-assignment">
          <Button className="gap-2 rounded-xl shadow-button">
            <Plus className="h-4 w-4" />
            إنشاء تكليف جديد
          </Button>
        </Link>
      </div>

      <div className="relative w-full sm:w-80">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ابحث عن تكليف..."
          className="h-10 rounded-xl pr-9"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-right font-medium text-muted-foreground">التكليف</th>
              <th className="hidden p-3 text-right font-medium text-muted-foreground md:table-cell">المادة</th>
              <th className="p-3 text-right font-medium text-muted-foreground">الموعد</th>
              <th className="p-3 text-right font-medium text-muted-foreground">التسليمات</th>
              <th className="p-3 text-right font-medium text-muted-foreground">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => {
              const count = teacherSubmissions.filter((submission) => submission.assignmentId === assignment.id).length;

              return (
                <tr
                  key={assignment.id}
                  className="border-b border-border transition-colors hover:bg-muted/50 last:border-0"
                >
                  <td className="px-5 py-3">
                    <Link
                      to={`/teacher/submissions?assignment=${assignment.id}`}
                      className="block transition-colors hover:text-primary"
                    >
                      <p className="truncate font-medium" title={assignment.title}>
                        {assignment.title}
                      </p>
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{assignment.level}</p>
                    {assignment.attachments.length > 0 && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="h-3.5 w-3.5" />
                        {assignment.attachments.length} مرفق
                      </p>
                    )}
                  </td>
                  <td className="hidden p-3 text-muted-foreground md:table-cell">{assignment.subject}</td>
                  <td className="p-3 text-muted-foreground tabular-nums">{formatDateLabel(assignment.dueAt)}</td>
                  <td className="p-3">
                    <Link
                      to={`/teacher/submissions?assignment=${assignment.id}`}
                      className="inline-flex flex-col text-right transition-colors hover:text-primary"
                    >
                      <span className="font-medium tabular-nums">{count}</span>
                      <span className="text-xs text-muted-foreground">
                        {assignment.maxSubmissions === 1
                          ? "محاولة واحدة لكل طالب"
                          : `حتى ${assignment.maxSubmissions} محاولات لكل طالب`}
                      </span>
                    </Link>
                  </td>
                  <td className="p-3">
                    <StatusBadge variant={assignment.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {assignments.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">لا توجد تكليفات مطابقة.</div>
        )}
      </div>
    </div>
  );
}
