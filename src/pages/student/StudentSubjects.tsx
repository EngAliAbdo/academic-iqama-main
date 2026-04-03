import { useMemo, useState } from "react";
import { BookOpen, FileText, Search, Upload, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { buildSubjectSummaries } from "@/lib/subject-directory";

export default function StudentSubjects() {
  const [query, setQuery] = useState("");
  const { user } = useAuth();
  const { getStudentAssignments, getStudentSubmissions, subjects } = useAcademicData();

  const subjectItems = useMemo(() => {
    if (!user) {
      return [];
    }

    const assignments = getStudentAssignments(user.id);
    const submissions = getStudentSubmissions(user.id);
    const normalizedQuery = query.trim().toLowerCase();

    return buildSubjectSummaries(assignments, submissions, subjects).filter((subject) => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        subject.name,
        subject.code ?? "",
        subject.department ?? "",
        subject.teacherNames.join(" "),
        subject.levels.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [getStudentAssignments, getStudentSubmissions, query, subjects, user]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h1 font-bold">المواد الدراسية</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            جميع المواد المرتبطة بالتكليفات المتاحة لك في الفصل الحالي.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث عن مادة أو رمز أو معلم..."
            className="h-10 rounded-xl pr-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjectItems.map((subject) => (
          <Link
            key={subject.id}
            to={`/student/assignments?query=${encodeURIComponent(subject.name)}`}
            className="group rounded-2xl bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
          >
            <div className="mb-4 w-fit rounded-xl bg-primary/10 p-3">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>

            <div className="space-y-1">
              <h3 className="line-clamp-2 text-lg font-semibold" title={subject.name}>
                {subject.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {subject.code ? `${subject.code} • ` : ""}
                {subject.levels.join(" / ") || "مستوى غير محدد"}
              </p>
            </div>

            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="flex min-w-0 items-center gap-1.5"
                  title={subject.teacherNames.join("، ") || "غير محدد"}
                >
                  <UserRound className="h-3.5 w-3.5" />
                  <span className="truncate">{subject.teacherNames.join("، ") || "غير محدد"}</span>
                </span>
              </div>

              {subject.department && (
                <p className="text-xs text-muted-foreground">{subject.department}</p>
              )}

              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {subject.assignmentCount} تكليفات
                </span>
                <span className="flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  {subject.submissionCount} تسليمات
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {subjectItems.length === 0 && (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
          لا توجد مواد مطابقة لبحثك حالياً.
        </div>
      )}
    </div>
  );
}
