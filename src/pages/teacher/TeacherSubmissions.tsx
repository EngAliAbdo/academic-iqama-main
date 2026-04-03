import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, Play, RefreshCw, Search } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
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
import { toast } from "@/hooks/use-toast";
import {
  formatAnalysisDuration,
  formatDateTimeLabel,
  formatDateLabel,
  getSubmissionAnalysisStatusLabel,
  getSubmissionBadgeVariant,
  isAnalysisPending,
} from "@/lib/academic-data";

function getAnalysisBadgeVariant(analysisStatus: string) {
  if (analysisStatus === "completed") {
    return "accepted";
  }

  if (analysisStatus === "failed" || analysisStatus === "manual_review_required") {
    return "revision";
  }

  return "review";
}

export default function TeacherSubmissions() {
  const [query, setQuery] = useState("");
  const [analysisFilter, setAnalysisFilter] = useState("all");
  const [startingSubmissionId, setStartingSubmissionId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    getAssignmentById,
    getTeacherSubmissions,
    isRefreshing,
    persistenceMode,
    refreshAcademicData,
    startSubmissionAnalysis,
  } = useAcademicData();
  const userId = user?.id ?? "";
  const assignmentFilter = searchParams.get("assignment") ?? "";
  const filteredAssignment = assignmentFilter ? getAssignmentById(assignmentFilter) : null;

  const submissions = useMemo(() => {
    if (!userId) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    return getTeacherSubmissions(userId).filter((submission) => {
      const assignment = getAssignmentById(submission.assignmentId);
      const matchesAssignment = !assignmentFilter || submission.assignmentId === assignmentFilter;
      const matchesQuery = !normalizedQuery || [
        submission.studentName,
        submission.academicId,
        assignment?.title ?? "",
        assignment?.subject ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
      const matchesAnalysis =
        analysisFilter === "all" || submission.analysisStatus === analysisFilter;

      return matchesAssignment && matchesQuery && matchesAnalysis;
    });
  }, [analysisFilter, assignmentFilter, getAssignmentById, getTeacherSubmissions, query, userId]);

  const canRefreshRemotely = persistenceMode === "supabase";
  const hasPendingSubmissions = submissions.some((submission) =>
    isAnalysisPending(submission.analysisStatus) && Boolean(submission.analysisRequestedAt),
  );

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold">صندوق التسليمات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          جميع التسليمات الواردة من الطلاب مع حالة التحليل والمراجعة.
        </p>
      </div>

      {canRefreshRemotely && (
        <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {hasPendingSubmissions
              ? "سيتم تحديث نتائج التحليل تلقائياً كل 15 ثانية أثناء وجود ملفات قيد الفحص."
              : "يمكنك تحديث القائمة يدوياً لجلب آخر حالات التحليل والمراجعة."}
          </p>
          <Button
            variant="outline"
            className="gap-2 rounded-xl sm:self-start"
            disabled={isRefreshing}
            onClick={() => {
              void refreshAcademicData();
            }}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card p-4 text-xs text-muted-foreground shadow-card">
        إذا كان خيار البدء التلقائي للتحليل معطلاً من إعدادات النظام، سيظهر زر{" "}
        <span className="font-semibold text-foreground">بدء التحليل</span>{" "}
        هنا للمعلم.
      </div>

      {filteredAssignment && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold">عرض تسليمات تكليف محدد</p>
            <p className="text-xs text-muted-foreground">
              {filteredAssignment.title}
              {filteredAssignment.subject ? ` - ${filteredAssignment.subject}` : ""}
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.delete("assignment");
              setSearchParams(nextParams);
            }}
          >
            عرض كل التسليمات
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث باسم الطالب أو الرقم الأكاديمي..."
            className="h-10 rounded-xl pr-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select value={analysisFilter} onValueChange={setAnalysisFilter}>
          <SelectTrigger className="h-10 rounded-xl sm:w-[190px]">
            <SelectValue placeholder="تصفية التحليل" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="pending">بانتظار البدء</SelectItem>
            <SelectItem value="processing">قيد التحليل</SelectItem>
            <SelectItem value="completed">تم التحليل</SelectItem>
            <SelectItem value="manual_review_required">مراجعة يدوية</SelectItem>
            <SelectItem value="failed">فشل التحليل</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 px-5 text-right font-medium text-muted-foreground">الطالب</th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground md:table-cell">
                  الرقم الأكاديمي
                </th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground lg:table-cell">
                  التكليف
                </th>
                <th className="p-3 text-right font-medium text-muted-foreground">التاريخ</th>
                <th className="p-3 text-right font-medium text-muted-foreground">التحليل</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الأصالة</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الحالة</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الدرجة</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => {
                const assignment = getAssignmentById(submission.assignmentId);
                const canStartAnalysis =
                  (submission.analysisStatus === "pending" && !submission.analysisRequestedAt)
                  || submission.analysisStatus === "failed";
                const isStartingThisRow = startingSubmissionId === submission.id;

                return (
                  <tr
                    key={submission.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-muted/50"
                  >
                    <td className="p-3 px-5 font-medium">{submission.studentName}</td>
                    <td className="hidden p-3 tabular-nums text-muted-foreground md:table-cell">
                      {submission.academicId}
                    </td>
                    <td className="hidden p-3 text-muted-foreground lg:table-cell">
                      {assignment?.title ?? "-"}
                    </td>
                    <td className="p-3 tabular-nums text-muted-foreground">
                      {formatDateLabel(submission.submittedAt)}
                    </td>
                    <td className="p-3">
                      <div className="space-y-1">
                        <StatusBadge
                          variant={getAnalysisBadgeVariant(submission.analysisStatus)}
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
                            {isAnalysisPending(submission.analysisStatus) ? "المدة الحالية" : "المدة"}:{" "}
                            {formatAnalysisDuration(
                              submission.analysisRequestedAt,
                              submission.analysisCompletedAt,
                            ) ?? "-"}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {submission.analysisStatus === "completed" ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className={
                                submission.originality >= 80
                                  ? "h-full rounded-full bg-success"
                                  : submission.originality >= 50
                                    ? "h-full rounded-full bg-warning"
                                    : "h-full rounded-full bg-destructive"
                              }
                              style={{ width: `${submission.originality}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums">{submission.originality}%</span>
                        </div>
                      ) : submission.analysisStatus === "manual_review_required" ? (
                        <span className="text-xs text-warning">مراجعة يدوية</span>
                      ) : submission.analysisStatus === "failed" ? (
                        <span className="text-xs text-destructive">فشل التحليل</span>
                      ) : submission.analysisRequestedAt ? (
                        <span className="text-xs text-muted-foreground">بانتظار النتيجة</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">بانتظار بدء التحليل</span>
                      )}
                    </td>
                    <td className="p-3">
                      <StatusBadge variant={getSubmissionBadgeVariant(submission.status)} />
                    </td>
                    <td className="p-3 font-medium tabular-nums">{submission.grade ?? "-"}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canStartAnalysis && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 rounded-lg text-xs"
                            disabled={isStartingThisRow}
                            onClick={async () => {
                              setStartingSubmissionId(submission.id);

                              try {
                                const result = await startSubmissionAnalysis(submission.id);
                                if (!result.submission) {
                                  toast({
                                    title: "تعذر بدء التحليل",
                                    description:
                                      result.error ?? "حدث خطأ أثناء تشغيل تحليل الأصالة لهذا التسليم.",
                                    variant: "destructive",
                                  });
                                  return;
                                }

                                toast({
                                  title:
                                    result.submission.analysisStatus === "completed"
                                      ? "تم تحديث نتيجة الأصالة"
                                      : "تم بدء التحليل",
                                  description:
                                    result.submission.analysisStatus === "completed"
                                      ? "تم حفظ النتيجة الجديدة لهذا التسليم."
                                      : "سيستمر تحديث الحالة تلقائياً حتى يكتمل التحليل.",
                                });
                              } finally {
                                setStartingSubmissionId(null);
                              }
                            }}
                          >
                            <Play className="h-3.5 w-3.5" />
                            {submission.analysisStatus === "failed" ? "إعادة التحليل" : "بدء التحليل"}
                          </Button>
                        )}

                        <Link to={`/teacher/review?submission=${submission.id}`}>
                          <Button variant="ghost" size="sm" className="gap-1 rounded-lg text-xs">
                            <Eye className="h-3.5 w-3.5" />
                            مراجعة
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {submissions.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            لا توجد نتائج مطابقة للبحث أو فلتر التحليل الحالي.
          </div>
        )}
      </div>
    </div>
  );
}
