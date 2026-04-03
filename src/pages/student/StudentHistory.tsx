import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateLabel, getSubmissionBadgeVariant } from "@/lib/academic-data";

export default function StudentHistory() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getAssignmentById, getStudentSubmissions } = useAcademicData();
  const userId = user?.id ?? "";

  const history = useMemo(() => {
    if (!userId) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    return getStudentSubmissions(userId).filter((submission) => {
      const assignment = getAssignmentById(submission.assignmentId);
      const matchesQuery = !normalizedQuery || [assignment?.title ?? "", assignment?.subject ?? "", submission.semester]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || submission.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [getAssignmentById, getStudentSubmissions, query, statusFilter, userId]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold">سجل التسليمات</h1>
        <p className="mt-1 text-sm text-muted-foreground">أرشيف جميع تسليماتك السابقة داخل النظام</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث في السجل..."
            className="h-10 rounded-xl pr-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 rounded-xl sm:w-[190px]">
            <SelectValue placeholder="تصفية الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="submitted">تم الرفع</SelectItem>
            <SelectItem value="review">قيد المراجعة</SelectItem>
            <SelectItem value="revision">يحتاج تعديل</SelectItem>
            <SelectItem value="graded">تم التقييم</SelectItem>
            <SelectItem value="accepted">مقبول</SelectItem>
            <SelectItem value="rejected">غير مقبول</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-right font-medium text-muted-foreground">التكليف</th>
              <th className="hidden p-3 text-right font-medium text-muted-foreground md:table-cell">المادة</th>
              <th className="hidden p-3 text-right font-medium text-muted-foreground lg:table-cell">الفصل</th>
              <th className="p-3 text-right font-medium text-muted-foreground">التاريخ</th>
              <th className="p-3 text-right font-medium text-muted-foreground">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {history.map((submission) => {
              const assignment = getAssignmentById(submission.assignmentId);
              return (
                <tr
                  key={submission.id}
                  className="cursor-pointer border-b border-border transition-colors hover:bg-muted/50 last:border-0"
                  onClick={() => {
                    navigate(`/student/status?assignment=${submission.assignmentId}`);
                  }}
                >
                  <td className="px-5 py-3 font-medium">
                    <div className="min-w-0">
                      <p className="break-words" title={assignment?.title ?? "تكليف"}>
                        {assignment?.title ?? "تكليف"}
                      </p>
                      <p className="mt-1 text-xs text-primary">فتح حالة التسليم</p>
                    </div>
                  </td>
                  <td className="hidden p-3 text-muted-foreground md:table-cell">
                    <span className="block truncate" title={assignment?.subject ?? "-"}>
                      {assignment?.subject ?? "-"}
                    </span>
                  </td>
                  <td className="hidden p-3 text-muted-foreground lg:table-cell">{submission.semester}</td>
                  <td className="p-3 tabular-nums text-muted-foreground">{formatDateLabel(submission.submittedAt)}</td>
                  <td className="p-3">
                    <StatusBadge variant={getSubmissionBadgeVariant(submission.status)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {history.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            لا توجد نتائج مطابقة للبحث أو الفلتر الحالي.
          </div>
        )}
      </div>
    </div>
  );
}
