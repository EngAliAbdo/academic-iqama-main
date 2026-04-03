import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  GraduationCap,
  PencilLine,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useRef } from "react";
import {
  ACADEMIC_DEPARTMENT_OPTIONS,
  ACADEMIC_LEVEL_OPTIONS,
  ACADEMIC_TERM_OPTIONS,
} from "@/lib/academic-catalog";
import { type AcademicSubject } from "@/lib/academic-data";
import { buildCatalogSubjectSummaries } from "@/lib/subject-directory";

const INITIAL_FORM = {
  id: "",
  nameAr: "",
  nameEn: "",
  code: "",
  department: ACADEMIC_DEPARTMENT_OPTIONS[0] ?? "",
  level: ACADEMIC_LEVEL_OPTIONS[0] ?? "",
  semester: ACADEMIC_TERM_OPTIONS[0] ?? "",
  status: "active" as AcademicSubject["status"],
};

function getSubjectStatusLabel(status: AcademicSubject["status"]) {
  return status === "archived" ? "مؤرشفة" : "نشطة";
}

export default function AdminSubjects() {
  const [query, setQuery] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingSubjectId, setIsUpdatingSubjectId] = useState<string | null>(null);
  const [isDeletingSubjectId, setIsDeletingSubjectId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AcademicSubject | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const nameArInputRef = useRef<HTMLInputElement | null>(null);
  const { authMode, directoryUsers } = useAuth();
  const {
    assignments,
    submissions,
    studentSubjectMappings,
    subjects,
    teacherSubjectMappings,
    createSubject,
    updateSubject,
    deleteSubject,
  } = useAcademicData();

  const teacherUsers = useMemo(
    () =>
      directoryUsers
        .filter((user) => user.role === "teacher")
        .sort((left, right) => left.fullName.localeCompare(right.fullName, "ar")),
    [directoryUsers],
  );

  const activeSubjects = useMemo(
    () => subjects.filter((subject) => subject.status === "active"),
    [subjects],
  );

  const teacherNameById = useMemo(
    () => new Map(teacherUsers.map((teacher) => [teacher.id, teacher.fullName])),
    [teacherUsers],
  );

  const subjectCatalog = useMemo(
    () =>
      buildCatalogSubjectSummaries(subjects, assignments, submissions, studentSubjectMappings).map((subject) => {
        const mappedTeacherNames = teacherSubjectMappings
          .filter((mapping) => mapping.subjectId === subject.id)
          .map((mapping) => teacherNameById.get(mapping.teacherId))
          .filter((value): value is string => Boolean(value));
        const resolvedTeacherNames = mappedTeacherNames.length > 0
          ? Array.from(new Set(mappedTeacherNames))
          : subject.teacherNames;

        return {
          ...subject,
          teacherNames: resolvedTeacherNames.sort((left, right) => left.localeCompare(right, "ar")),
        };
      }),
    [assignments, studentSubjectMappings, submissions, subjects, teacherNameById, teacherSubjectMappings],
  );


  const subjectItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return subjectCatalog.filter((subject) => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        subject.name,
        subject.code ?? "",
        subject.department ?? "",
        subject.semester ?? "",
        subject.status === "archived" ? "مؤرشفة" : "نشطة",
        subject.teacherNames.join(" "),
        subject.levels.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, subjectCatalog]);

  const metrics = useMemo(() => {
    const uniqueTeachers = teacherSubjectMappings.length > 0
      ? new Set(teacherSubjectMappings.map((mapping) => mapping.teacherId)).size
      : new Set(subjectCatalog.flatMap((subject) => subject.teacherNames)).size;
    const totalStudents = studentSubjectMappings.length > 0
      ? new Set(studentSubjectMappings.map((mapping) => mapping.studentId)).size
      : new Set(submissions.map((submission) => submission.studentId)).size;

    return {
      subjects: subjects.length,
      activeSubjects: activeSubjects.length,
      teachers: uniqueTeachers,
      students: totalStudents,
    };
  }, [activeSubjects.length, studentSubjectMappings, subjectCatalog, subjects.length, submissions, teacherSubjectMappings]);

  const handleFieldChange = (field: keyof typeof INITIAL_FORM, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openCreateForm = () => {
    setForm(INITIAL_FORM);
    setFormMode("create");
  };

  const openEditForm = (subject: AcademicSubject) => {
    setForm({
      id: subject.id,
      nameAr: subject.nameAr,
      nameEn: subject.nameEn,
      code: subject.code,
      department: subject.department,
      level: subject.level,
      semester: subject.semester,
      status: subject.status,
    });
    setFormMode("edit");
  };

  const closeForm = () => {
    setForm(INITIAL_FORM);
    setFormMode(null);
  };

  useEffect(() => {
    if (!formMode) {
      return;
    }

    window.requestAnimationFrame(() => {
      formCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      nameArInputRef.current?.focus({ preventScroll: true });
    });
  }, [form.id, formMode]);

  useEffect(() => {
    if (formMode !== "edit" || !form.id) {
      return;
    }

    if (subjects.some((subject) => subject.id === form.id)) {
      return;
    }

    closeForm();
  }, [form.id, formMode, subjects]);

  const handleSaveSubject = async () => {
    const payload = {
      id: form.id,
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim(),
      code: form.code.trim().toUpperCase(),
      department: form.department.trim(),
      level: form.level.trim(),
      semester: form.semester.trim(),
      status: form.status,
    };

    if (
      !payload.nameAr
      || !payload.nameEn
      || !payload.code
      || !payload.department
      || !payload.level
      || !payload.semester
    ) {
      toast({
        title: "البيانات ناقصة",
        description: "أكمل اسم المادة والرمز والقسم والمستوى والفصل قبل الحفظ.",
        variant: "destructive",
      });
      return;
    }

    const duplicate = subjects.some(
      (subject) =>
        subject.code.toLowerCase() === payload.code.toLowerCase()
        && (formMode !== "edit" || subject.id !== payload.id),
    );

    if (duplicate) {
      toast({
        title: "رمز المادة مستخدم",
        description: "أدخل رمزًا مختلفًا للمادة قبل الحفظ.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const saved = formMode === "edit"
        ? await updateSubject(payload)
        : await createSubject(payload);

      if (!saved) {
        toast({
          title: formMode === "edit" ? "تعذر تحديث المادة" : "تعذر إنشاء المادة",
          description: "حدث خطأ أثناء حفظ بيانات المادة في قاعدة البيانات.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: formMode === "edit" ? "تم تحديث المادة" : "تمت إضافة المادة",
        description:
          formMode === "edit"
            ? `تم تحديث مادة ${saved.nameAr} بنجاح.`
            : `تم حفظ مادة ${saved.nameAr} بنجاح.`,
      });

      setQuery(saved.nameAr);
      closeForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSubjectStatus = async (subject: AcademicSubject) => {
    setIsUpdatingSubjectId(subject.id);

    try {
      const nextStatus: AcademicSubject["status"] =
        subject.status === "active" ? "archived" : "active";

      const updated = await updateSubject({
        id: subject.id,
        nameAr: subject.nameAr,
        nameEn: subject.nameEn,
        code: subject.code,
        department: subject.department,
        level: subject.level,
        semester: subject.semester,
        status: nextStatus,
      });

      if (!updated) {
        toast({
          title: "تعذر تحديث حالة المادة",
          description: "حدث خطأ أثناء تحديث حالة المادة في قاعدة البيانات.",
          variant: "destructive",
        });
        return;
      }

      if (formMode === "edit" && form.id === updated.id) {
        setForm((current) => ({
          ...current,
          status: updated.status,
        }));
      }

      toast({
        title: updated.status === "archived" ? "تمت أرشفة المادة" : "تم تفعيل المادة",
        description:
          updated.status === "archived"
            ? `بقيت مادة ${updated.nameAr} داخل جدول المواد بحالة مؤرشفة، ولن تظهر في إنشاء التكليفات الجديدة حتى إعادة تفعيلها.`
            : `عادت مادة ${updated.nameAr} إلى حالة نشطة، وستظهر مرة أخرى داخل إنشاء التكليفات.`,
      });
    } finally {
      setIsUpdatingSubjectId(null);
    }
  };

  const handleDeleteSubject = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeletingSubjectId(deleteTarget.id);

    try {
      const result = await deleteSubject({ subjectId: deleteTarget.id });
      if (!result.ok) {
        toast({
          title: "تعذر حذف المادة",
          description: result.error ?? "حدث خطأ أثناء حذف المادة.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "تم حذف المادة",
        description: `تم حذف مادة ${deleteTarget.nameAr} نهائيًا بنجاح.`,
      });

      if (formMode === "edit" && form.id === deleteTarget.id) {
        closeForm();
      }

      setDeleteTarget(null);
    } finally {
      setIsDeletingSubjectId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-h1 font-bold">المواد والهيكل الأكاديمي</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            دليل المواد المركزي الذي تعتمد عليه التكليفات وربط المعلمين والطلاب.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            مصدر البيانات الحالي: {authMode === "supabase" ? "Supabase" : "محلي تجريبي"}
          </p>
        </div>

        <Button
          className="gap-2 rounded-xl shadow-button"
          onClick={() => {
            if (formMode === "create") {
              closeForm();
              return;
            }

            openCreateForm();
          }}
        >
          <Plus className="h-4 w-4" />
          {formMode === "create" ? "إخفاء النموذج" : "إضافة مادة"}
        </Button>
      </div>

      {formMode && (
        <div ref={formCardRef} className="space-y-4 rounded-2xl bg-card p-6 shadow-card">
          <div>
            <h2 className="font-semibold">
              {formMode === "edit" ? "تحديث بيانات المادة" : "إضافة مادة جديدة"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formMode === "edit"
                ? "حدّث اسم المادة ورمزها وقسمها، أو غيّر حالتها إذا أردت إيقاف ظهورها في إنشاء التكليفات."
                : "سيتم حفظ المادة في الدليل المركزي لتصبح متاحة في إنشاء التكليفات وربط المعلمين."}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="subject-name-ar">اسم المادة بالعربية</Label>
              <Input
                id="subject-name-ar"
                ref={nameArInputRef}
                value={form.nameAr}
                onChange={(event) => handleFieldChange("nameAr", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-name-en">اسم المادة بالإنجليزية</Label>
              <Input
                id="subject-name-en"
                value={form.nameEn}
                onChange={(event) => handleFieldChange("nameEn", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-code">رمز المادة</Label>
              <Input
                id="subject-code"
                placeholder="CS401"
                value={form.code}
                onChange={(event) => handleFieldChange("code", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-department">القسم</Label>
              <Select
                value={form.department || undefined}
                onValueChange={(value) => handleFieldChange("department", value)}
              >
                <SelectTrigger id="subject-department" className="h-11 rounded-xl">
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  {ACADEMIC_DEPARTMENT_OPTIONS.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-level">المستوى</Label>
              <Select
                value={form.level || undefined}
                onValueChange={(value) => handleFieldChange("level", value)}
              >
                <SelectTrigger id="subject-level" className="h-11 rounded-xl">
                  <SelectValue placeholder="اختر المستوى" />
                </SelectTrigger>
                <SelectContent>
                  {ACADEMIC_LEVEL_OPTIONS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-semester">الفصل</Label>
              <Select
                value={form.semester || undefined}
                onValueChange={(value) => handleFieldChange("semester", value)}
              >
                <SelectTrigger id="subject-semester" className="h-11 rounded-xl">
                  <SelectValue placeholder="اختر الفصل" />
                </SelectTrigger>
                <SelectContent>
                  {ACADEMIC_TERM_OPTIONS.map((semester) => (
                    <SelectItem key={semester} value={semester}>
                      {semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formMode === "edit" && (
            <div className="space-y-2 md:max-w-sm">
              <Label>حالة المادة</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    status: value as AcademicSubject["status"],
                  }))}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشطة</SelectItem>
                  <SelectItem value="archived">مؤرشفة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              className="rounded-xl shadow-button"
              disabled={isSubmitting}
              onClick={() => {
                void handleSaveSubject();
              }}
            >
              {isSubmitting
                ? formMode === "edit"
                  ? "جارٍ التحديث..."
                  : "جارٍ الحفظ..."
                : formMode === "edit"
                  ? "حفظ التعديلات"
                  : "حفظ المادة"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={isSubmitting}
              onClick={closeForm}
            >
              إلغاء
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="إجمالي المواد" value={metrics.subjects} icon={BookOpen} />
        <StatCard title="المواد النشطة" value={metrics.activeSubjects} icon={BookOpen} />
        <StatCard title="المعلمون المرتبطون" value={metrics.teachers} icon={UserRound} />
        <StatCard title="الطلاب النشطون" value={metrics.students} icon={GraduationCap} />
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث عن مادة أو رمز أو قسم أو فصل..."
            className="h-10 rounded-xl pr-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 px-5 text-right font-medium text-muted-foreground">المادة</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الرمز</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الحالة</th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground md:table-cell">
                  القسم
                </th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground lg:table-cell">
                  المستوى / الفصل
                </th>
                <th className="p-3 text-right font-medium text-muted-foreground">المعلم</th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground xl:table-cell">
                  التكليفات
                </th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground xl:table-cell">
                  الطلاب
                </th>
                <th className="p-3 text-right font-medium text-muted-foreground">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {subjectItems.map((subject) => {
                const isUpdating = isUpdatingSubjectId === subject.id;

                return (
                  <tr
                    key={subject.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-muted/50"
                  >
                    <td className="p-3 px-5">
                      <div className="space-y-1">
                        <p className="font-medium">{subject.name}</p>
                        {subject.semester && (
                          <p className="text-xs text-muted-foreground">{subject.semester}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{subject.code || "-"}</td>
                    <td className="p-3">
                      <span
                        className={
                          subject.status === "archived"
                            ? "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                            : "inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                        }
                      >
                        {getSubjectStatusLabel(subject.status)}
                      </span>
                    </td>
                    <td className="hidden p-3 text-muted-foreground md:table-cell">
                      {subject.department || "-"}
                    </td>
                    <td className="hidden p-3 text-muted-foreground lg:table-cell">
                      {subject.levels.join(" / ") || "-"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {subject.teacherNames.join("، ") || "-"}
                    </td>
                    <td className="hidden p-3 tabular-nums xl:table-cell">{subject.assignmentCount}</td>
                    <td className="hidden p-3 tabular-nums xl:table-cell">{subject.studentCount}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 rounded-xl"
                          onClick={() => {
                            const currentSubject = subjects.find((item) => item.id === subject.id);
                            if (currentSubject) {
                              openEditForm(currentSubject);
                            }
                          }}
                        >
                          <PencilLine className="h-4 w-4" />
                          تعديل
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 rounded-xl"
                          disabled={isUpdating}
                          onClick={() => {
                            const currentSubject = subjects.find((item) => item.id === subject.id);
                            if (currentSubject) {
                              void handleToggleSubjectStatus(currentSubject);
                            }
                          }}
                        >
                          {subject.status === "archived" ? (
                            <RotateCcw className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                          {isUpdating
                            ? "جارٍ التحديث..."
                            : subject.status === "archived"
                              ? "إعادة تفعيل"
                              : "أرشفة"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 rounded-xl text-destructive hover:text-destructive"
                          disabled={isDeletingSubjectId === subject.id}
                          onClick={() => {
                            const currentSubject = subjects.find((item) => item.id === subject.id);
                            if (currentSubject) {
                              setDeleteTarget(currentSubject);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          {isDeletingSubjectId === subject.id ? "جارٍ الحذف..." : "حذف"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {subjectItems.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            لا توجد مواد مطابقة لبحثك حاليًا.
          </div>
        )}
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المادة</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `سيتم حذف مادة ${deleteTarget.nameAr} نهائيًا إذا لم تكن مرتبطة بتكليفات أو معلمين أو طلاب. إذا كانت المادة مستخدمة تاريخيًا فالأفضل أرشفتها بدلًا من حذفها.`
                : "سيتم حذف المادة نهائيًا إذا لم تكن مرتبطة ببيانات أكاديمية."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={isDeletingSubjectId !== null}>
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingSubjectId !== null}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteSubject();
              }}
            >
              {isDeletingSubjectId !== null ? "جارٍ الحذف..." : "تأكيد الحذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
