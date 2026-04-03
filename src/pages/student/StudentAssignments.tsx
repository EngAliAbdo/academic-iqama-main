import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Calendar, Paperclip, Search } from "lucide-react";
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
import { formatDateLabel, getStudentAssignmentBadge } from "@/lib/academic-data";

export default function StudentAssignments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const { user } = useAuth();
  const { getStudentAssignments, getStudentSubmission } = useAcademicData();
  const userId = user?.id ?? "";

  useEffect(() => {
    setQuery(searchParams.get("query") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (query.trim()) {
      nextParams.set("query", query.trim());
    } else {
      nextParams.delete("query");
    }
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [query, searchParams, setSearchParams]);

  const assignments = useMemo(() => {
    if (!userId) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    const now = new Date();
    const upcomingLimit = new Date(now);
    upcomingLimit.setDate(upcomingLimit.getDate() + 7);

    return getStudentAssignments(userId).filter((assignment) => {
      const submission = getStudentSubmission(userId, assignment.id);
      const searchableText = [assignment.title, assignment.subject, assignment.teacherName]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);

      const dueDate = new Date(assignment.dueAt);
      const matchesStatus = (() => {
        switch (statusFilter) {
          case "pending_upload":
            return !submission;
          case "submitted":
            return Boolean(submission) && submission.status === "submitted";
          case "under_review":
            return Boolean(submission) && (submission.status === "review" || submission.status === "revision");
          case "completed":
            return Boolean(submission) && ["graded", "accepted", "rejected"].includes(submission.status);
          default:
            return true;
        }
      })();

      const matchesDate = (() => {
        switch (dateFilter) {
          case "overdue":
            return dueDate < now;
          case "next_7_days":
            return dueDate >= now && dueDate <= upcomingLimit;
          case "this_month":
            return dueDate.getFullYear() === now.getFullYear() && dueDate.getMonth() === now.getMonth();
          default:
            return true;
        }
      })();

      return matchesQuery && matchesStatus && matchesDate;
    });
  }, [dateFilter, getStudentAssignments, getStudentSubmission, query, statusFilter, userId]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold">التكليفات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          جميع التكليفات المطلوبة منك مع حالتها الحالية.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث عن تكليف أو مادة أو معلم..."
            className="h-10 rounded-xl pr-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 rounded-xl sm:w-[180px]">
            <SelectValue placeholder="تصفية الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="pending_upload">بانتظار الرفع</SelectItem>
            <SelectItem value="submitted">تم الرفع</SelectItem>
            <SelectItem value="under_review">تحت المراجعة</SelectItem>
            <SelectItem value="completed">مكتملة</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="h-10 rounded-xl sm:w-[180px]">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="تصفية التاريخ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل التواريخ</SelectItem>
            <SelectItem value="overdue">متأخرة</SelectItem>
            <SelectItem value="next_7_days">خلال 7 أيام</SelectItem>
            <SelectItem value="this_month">هذا الشهر</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">التكليف</th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground md:table-cell">المادة</th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground lg:table-cell">المعلم</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الموعد النهائي</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الحالة</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => {
                const submission = getStudentSubmission(user.id, assignment.id);
                const badge = getStudentAssignmentBadge(assignment, submission);
                const uploadHref = `/student/upload?assignment=${assignment.id}`;
                const actionHref = submission
                  ? `/student/status?assignment=${assignment.id}`
                  : uploadHref;

                return (
                  <tr
                    key={assignment.id}
                    className="border-b border-border transition-colors hover:bg-muted/50 last:border-0"
                  >
                    <td className="px-5 py-3">
                      <Link to={uploadHref} className="block hover:opacity-90">
                        <p className="font-medium text-primary hover:underline">{assignment.title}</p>
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground md:hidden">
                        <Link to={uploadHref} className="hover:text-primary hover:underline">
                          {assignment.subject}
                        </Link>
                      </p>
                      {assignment.attachments.length > 0 && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Paperclip className="h-3.5 w-3.5" />
                          {assignment.attachments.length} مرفق
                        </p>
                      )}
                    </td>
                    <td className="hidden p-3 text-muted-foreground md:table-cell">
                      <Link to={uploadHref} className="hover:text-primary hover:underline">
                        {assignment.subject}
                      </Link>
                    </td>
                    <td className="hidden p-3 text-muted-foreground lg:table-cell">{assignment.teacherName}</td>
                    <td className="p-3 text-muted-foreground tabular-nums">{formatDateLabel(assignment.dueAt)}</td>
                    <td className="p-3">
                      <StatusBadge variant={badge} />
                    </td>
                    <td className="p-3">
                      <Link to={actionHref}>
                        <button className="rounded-lg px-3 py-1.5 text-xs hover:bg-muted">
                          {submission ? "متابعة التكليف" : "رفع لهذا التكليف"}
                        </button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {assignments.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            لا توجد نتائج مطابقة للبحث أو الفلتر الحالي.
          </div>
        )}
      </div>
    </div>
  );
}
