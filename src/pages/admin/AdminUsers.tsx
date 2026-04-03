import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  ACADEMIC_DEPARTMENT_OPTIONS,
  ACADEMIC_LEVEL_OPTIONS,
  ACADEMIC_TERM_OPTIONS,
  getDepartmentOptionsForRole,
} from "@/lib/academic-catalog";
import type { AuthUser, UserRole } from "@/lib/auth";
import {
  createSupabaseAdminUser,
  deleteSupabaseAdminUser,
  updateSupabaseAdminUser,
} from "@/lib/admin-user-api";
import { isSupabaseConfigured } from "@/lib/supabase-app";

type UserFilter = "all" | UserRole | "password";
type DialogMode = "create" | "edit";

interface UserFormState {
  fullName: string;
  email: string;
  role: UserRole;
  identifier: string;
  department: string;
  roleTitle: string;
  level: string;
  semester: string;
  password: string;
  forcePasswordChange: boolean;
}

interface AcademicScopeFormState {
  id: string;
  department: string;
  level: string;
  semester: string;
  subjectIds: string[];
}

function getRoleLabel(role: UserRole) {
  return {
    student: "طالب",
    teacher: "معلم",
    admin: "مسؤول",
  }[role];
}

function getRoleBadgeVariant(role: UserRole) {
  return ({
    student: "submitted",
    teacher: "published",
    admin: "accepted",
  } as const)[role];
}

function getIdentifier(user: AuthUser) {
  return user.academicId || user.email;
}

function matchesFilter(user: AuthUser, filter: UserFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "password") {
    return user.mustChangePassword;
  }

  return user.role === filter;
}

function getDefaultRoleTitle(role: UserRole) {
  return {
    student: "طالب",
    teacher: "عضو هيئة التدريس",
    admin: "مسؤول النظام",
  }[role];
}

function createInitialFormState(): UserFormState {
  return {
    fullName: "",
    email: "",
    role: "student",
    identifier: "",
    department: getDepartmentOptionsForRole("student")[0] ?? "",
    roleTitle: getDefaultRoleTitle("student"),
    level: ACADEMIC_LEVEL_OPTIONS[0] ?? "",
    semester: ACADEMIC_TERM_OPTIONS[0] ?? "",
    password: "",
    forcePasswordChange: true,
  };
}

function createAcademicScopeState(
  overrides: Partial<Omit<AcademicScopeFormState, "id">> & { id?: string } = {},
): AcademicScopeFormState {
  return {
    id: overrides.id ?? `scope-${Math.random().toString(36).slice(2, 10)}`,
    department: overrides.department ?? ACADEMIC_DEPARTMENT_OPTIONS[0] ?? "",
    level: overrides.level ?? ACADEMIC_LEVEL_OPTIONS[0] ?? "",
    semester: overrides.semester ?? ACADEMIC_TERM_OPTIONS[0] ?? "",
    subjectIds: overrides.subjectIds ? Array.from(new Set(overrides.subjectIds)) : [],
  };
}

function buildAcademicScopesFromUser(
  user: AuthUser,
  subjectIds: string[],
  subjects: {
    id: string;
    department: string;
    level: string;
    semester: string;
  }[],
) {
  const scopeMap = new Map<string, AcademicScopeFormState>();

  for (const subjectId of subjectIds) {
    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject) {
      continue;
    }

    const department = subject.department || user.department || ACADEMIC_DEPARTMENT_OPTIONS[0] || "";
    const level = subject.level || user.level || ACADEMIC_LEVEL_OPTIONS[0] || "";
    const semester = subject.semester || user.semester || ACADEMIC_TERM_OPTIONS[0] || "";
    const scopeKey = [department, level, semester].join("::");
    const existing = scopeMap.get(scopeKey);

    if (existing) {
      existing.subjectIds = Array.from(new Set([...existing.subjectIds, subjectId]));
      continue;
    }

    scopeMap.set(
      scopeKey,
      createAcademicScopeState({
        department,
        level,
        semester,
        subjectIds: [subjectId],
      }),
    );
  }

  if (scopeMap.size > 0) {
    return Array.from(scopeMap.values());
  }

  return [
    createAcademicScopeState({
      department: user.department || ACADEMIC_DEPARTMENT_OPTIONS[0] || "",
      level: user.level || ACADEMIC_LEVEL_OPTIONS[0] || "",
      semester: user.semester || ACADEMIC_TERM_OPTIONS[0] || "",
    }),
  ];
}

function createEditFormState(user: AuthUser): UserFormState {
  return {
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    identifier: user.academicId,
    department: user.role === "admin" ? "" : user.department,
    roleTitle: user.roleTitle,
    level: user.role === "admin" ? "" : user.level ?? "",
    semester: user.role === "admin" ? "" : user.semester ?? "",
    password: "",
    forcePasswordChange: user.mustChangePassword,
  };
}

function getUserSubjectIds(
  user: AuthUser,
  teacherMappings: { teacherId: string; subjectId: string }[],
  studentMappings: { studentId: string; subjectId: string }[],
) {
  if (user.role === "teacher") {
    return Array.from(
      new Set(
        teacherMappings
          .filter((mapping) => mapping.teacherId === user.id)
          .map((mapping) => mapping.subjectId),
      ),
    );
  }

  if (user.role === "student") {
    return Array.from(
      new Set(
        studentMappings
          .filter((mapping) => mapping.studentId === user.id)
          .map((mapping) => mapping.subjectId),
      ),
    );
  }

  return [];
}

export default function AdminUsers() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [formState, setFormState] = useState<UserFormState>(createInitialFormState);
  const [academicScopes, setAcademicScopes] = useState<AcademicScopeFormState[]>([
    createAcademicScopeState(),
  ]);
  const { authMode, directoryUsers, refreshDirectoryUsers } = useAuth();
  const {
    subjects,
    studentSubjectMappings,
    teacherSubjectMappings,
    assignStudentSubject,
    assignTeacherSubject,
    removeStudentSubjectMapping,
    removeTeacherSubjectMapping,
  } = useAcademicData();

  const canManageUsers = authMode === "supabase" && isSupabaseConfigured();
  const identifierLabel = formState.role === "student" ? "الرقم الأكاديمي" : "رقم الموظف";
  const identifierPlaceholder = formState.role === "student" ? "مثال: 202312346" : "مثال: 9001002";

  useEffect(() => {
    if (!dialogOpen) {
      setFormState(createInitialFormState());
      setEditingUser(null);
      setDialogMode("create");
      setAcademicScopes([createAcademicScopeState()]);
      setSubmitting(false);
    }
  }, [dialogOpen]);

  const activeSubjects = useMemo(
    () =>
      subjects
        .filter((subject) => subject.status === "active")
        .sort((left, right) => left.nameAr.localeCompare(right.nameAr, "ar")),
    [subjects],
  );

  const selectedSubjectIds = useMemo(
    () => Array.from(new Set(academicScopes.flatMap((scope) => scope.subjectIds))),
    [academicScopes],
  );

  useEffect(() => {
    if (formState.role === "admin") {
      return;
    }

    const primaryScope = academicScopes[0];
    if (!primaryScope) {
      return;
    }

    setFormState((current) => ({
      ...current,
      department: primaryScope.department,
      level: primaryScope.level,
      semester: primaryScope.semester,
    }));
  }, [academicScopes, formState.role]);

  const userMetrics = useMemo(() => {
    const students = directoryUsers.filter((user) => user.role === "student").length;
    const teachers = directoryUsers.filter((user) => user.role === "teacher").length;
    const admins = directoryUsers.filter((user) => user.role === "admin").length;
    const passwordResetRequired = directoryUsers.filter((user) => user.mustChangePassword).length;

    return { students, teachers, admins, passwordResetRequired };
  }, [directoryUsers]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return directoryUsers
      .filter((user) => matchesFilter(user, filter))
      .filter((user) => {
        if (!normalizedQuery) {
          return true;
        }

        return [
          user.fullName,
          user.email,
          user.department,
          user.roleTitle,
          getIdentifier(user),
          getRoleLabel(user.role),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => left.fullName.localeCompare(right.fullName, "ar"));
  }, [directoryUsers, filter, query]);

  const updateFormState = <Key extends keyof UserFormState>(
    key: Key,
    value: UserFormState[Key],
  ) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const handleRoleChange = (role: UserRole) => {
    const nextDepartmentOptions = Array.from(getDepartmentOptionsForRole(role));
    setFormState((current) => ({
      ...current,
      role,
      roleTitle:
        current.roleTitle === getDefaultRoleTitle(current.role)
          ? getDefaultRoleTitle(role)
          : current.roleTitle,
      identifier: "",
      department: role === "admin"
        ? ""
        : nextDepartmentOptions.includes(current.department)
          ? current.department
          : nextDepartmentOptions[0] ?? "",
      level: role === "admin" ? "" : current.level || ACADEMIC_LEVEL_OPTIONS[0] || "",
      semester: role === "admin" ? "" : current.semester || ACADEMIC_TERM_OPTIONS[0] || "",
    }));
    setAcademicScopes(
      role === "admin"
        ? []
        : [createAcademicScopeState({
            department: nextDepartmentOptions[0] ?? ACADEMIC_DEPARTMENT_OPTIONS[0] ?? "",
          })],
    );
  };

  const openCreateDialog = () => {
    setDialogMode("create");
    setEditingUser(null);
    setFormState(createInitialFormState());
    setAcademicScopes([createAcademicScopeState()]);
    setDialogOpen(true);
  };

  const openEditDialog = (user: AuthUser) => {
    setDialogMode("edit");
    setEditingUser(user);
    setFormState(createEditFormState(user));
    setAcademicScopes(
      user.role === "admin"
        ? []
        : buildAcademicScopesFromUser(
            user,
            getUserSubjectIds(user, teacherSubjectMappings, studentSubjectMappings),
            subjects,
          ),
    );
    setDialogOpen(true);
  };

  const openDeleteDialog = (user: AuthUser) => {
    setDeleteTarget(user);
  };

  const updateAcademicScope = (
    scopeId: string,
    field: "department" | "level" | "semester",
    value: string,
  ) => {
    setAcademicScopes((current) =>
      current.map((scope) =>
        scope.id === scopeId
          ? { ...scope, [field]: value, subjectIds: [] }
          : scope,
      ),
    );
  };

  const toggleScopeSubjectSelection = (scopeId: string, subjectId: string, checked: boolean) => {
    setAcademicScopes((current) =>
      current.map((scope) => {
        if (scope.id !== scopeId) {
          return scope;
        }

        return {
          ...scope,
          subjectIds: checked
            ? Array.from(new Set([...scope.subjectIds, subjectId]))
            : scope.subjectIds.filter((item) => item !== subjectId),
        };
      }),
    );
  };

  const setScopeSubjectSelections = (scopeId: string, subjectIds: string[]) => {
    setAcademicScopes((current) =>
      current.map((scope) =>
        scope.id === scopeId
          ? {
              ...scope,
              subjectIds: Array.from(new Set(subjectIds)),
            }
          : scope,
      ),
    );
  };

  const addAcademicScope = () => {
    setAcademicScopes((current) => [...current, createAcademicScopeState()]);
  };

  const removeAcademicScope = (scopeId: string) => {
    setAcademicScopes((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter((scope) => scope.id !== scopeId);
    });
  };

  const getSubjectOptionsForScope = (scope: AcademicScopeFormState) => {
    const filtered = activeSubjects.filter((subject) => {
      const matchesDepartment =
        !scope.department || !subject.department || subject.department === scope.department;
      const matchesLevel =
        !scope.level || !subject.level || subject.level === scope.level;
      const matchesSemester =
        !scope.semester || !subject.semester || subject.semester === scope.semester;

      return matchesDepartment && matchesLevel && matchesSemester;
    });

    const selectedFallback = activeSubjects.filter((subject) => scope.subjectIds.includes(subject.id));

    return Array.from(
      new Map(
        [...filtered, ...selectedFallback].map((subject) => [subject.id, subject]),
      ).values(),
    );
  };

  const syncUserSubjectMappings = async (targetUser: AuthUser, nextRole: UserRole) => {
    const desiredSubjectIds = new Set(selectedSubjectIds);
    const currentTeacherMappings = teacherSubjectMappings.filter(
      (mapping) => mapping.teacherId === targetUser.id,
    );
    const currentStudentMappings = studentSubjectMappings.filter(
      (mapping) => mapping.studentId === targetUser.id,
    );

    if (nextRole !== "teacher") {
      for (const mapping of currentTeacherMappings) {
        const removed = await removeTeacherSubjectMapping({ mappingId: mapping.id });
        if (!removed) {
          return "تعذر إزالة روابط المعلم السابقة بعد تغيير دوره.";
        }
      }
    }

    if (nextRole !== "student") {
      for (const mapping of currentStudentMappings) {
        const removed = await removeStudentSubjectMapping({ mappingId: mapping.id });
        if (!removed) {
          return "تعذر إزالة روابط الطالب السابقة بعد تغيير دوره.";
        }
      }
    }

    if (nextRole === "teacher") {
      for (const mapping of currentTeacherMappings) {
        if (!desiredSubjectIds.has(mapping.subjectId)) {
          const removed = await removeTeacherSubjectMapping({ mappingId: mapping.id });
          if (!removed) {
            return "تعذر فك ربط بعض مواد المعلم الحالية.";
          }
        }
      }

      const currentSubjectIds = new Set(
        currentTeacherMappings.map((mapping) => mapping.subjectId),
      );
      for (const subjectId of desiredSubjectIds) {
        if (!currentSubjectIds.has(subjectId)) {
          const created = await assignTeacherSubject({
            teacherId: targetUser.id,
            subjectId,
          });
          if (!created) {
            return "تعذر ربط بعض المواد بالمعلم.";
          }
        }
      }

      return null;
    }

    if (nextRole === "student") {
      for (const mapping of currentStudentMappings) {
        if (!desiredSubjectIds.has(mapping.subjectId)) {
          const removed = await removeStudentSubjectMapping({ mappingId: mapping.id });
          if (!removed) {
            return "تعذر فك ربط بعض مواد الطالب الحالية.";
          }
        }
      }

      const currentSubjectIds = new Set(
        currentStudentMappings.map((mapping) => mapping.subjectId),
      );
      for (const subjectId of desiredSubjectIds) {
        if (!currentSubjectIds.has(subjectId)) {
          const created = await assignStudentSubject({
            studentId: targetUser.id,
            subjectId,
          });
          if (!created) {
            return "تعذر ربط بعض المواد بالطالب.";
          }
        }
      }

      return null;
    }

    return null;
  };

  const handleSaveUser = async () => {
    if (!canManageUsers) {
      toast({
        title: "الإدارة غير متاحة",
        description: "يجب تشغيل Supabase الحقيقي لإدارة المستخدمين من هذه الشاشة.",
        variant: "destructive",
      });
      return;
    }

    const primaryScope = formState.role === "admin" ? null : academicScopes[0] ?? null;
    const effectiveDepartment = formState.role === "admin"
      ? ""
      : primaryScope?.department?.trim() || formState.department.trim();
    const effectiveLevel = formState.role === "admin"
      ? ""
      : primaryScope?.level?.trim() || formState.level.trim();
    const effectiveSemester = formState.role === "admin"
      ? ""
      : primaryScope?.semester?.trim() || formState.semester.trim();

    if (
      !formState.fullName.trim()
      || !formState.email.trim()
      || !formState.identifier.trim()
      || (formState.role !== "admin" && !effectiveDepartment)
    ) {
      toast({
        title: "البيانات ناقصة",
        description: formState.role === "admin"
          ? "أدخل الاسم والبريد والمعرّف قبل الحفظ."
          : "أدخل الاسم والبريد والمعرّف والقسم قبل الحفظ.",
        variant: "destructive",
      });
      return;
    }

    if (formState.role !== "admin" && !primaryScope) {
      toast({
        title: "الخطة الأكاديمية ناقصة",
        description: "أضف على الأقل مجموعة أكاديمية واحدة للمستخدم قبل الحفظ.",
        variant: "destructive",
      });
      return;
    }

    if (dialogMode === "create" && !formState.password.trim()) {
      toast({
        title: "كلمة المرور مطلوبة",
        description: "أدخل كلمة مرور مؤقتة قبل إنشاء المستخدم.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const result = dialogMode === "create"
      ? await createSupabaseAdminUser({
          email: formState.email,
          password: formState.password,
          role: formState.role,
          fullName: formState.fullName,
          identifier: formState.identifier,
          department: effectiveDepartment,
          roleTitle: formState.roleTitle,
          level: effectiveLevel,
          semester: effectiveSemester,
          forcePasswordChange: formState.forcePasswordChange,
        })
      : await updateSupabaseAdminUser({
          userId: editingUser?.id ?? "",
          email: formState.email,
          password: formState.password || undefined,
          role: formState.role,
          fullName: formState.fullName,
          identifier: formState.identifier,
          department: effectiveDepartment,
          roleTitle: formState.roleTitle,
          level: effectiveLevel || undefined,
          semester: effectiveSemester || undefined,
          forcePasswordChange: formState.forcePasswordChange,
        });

    setSubmitting(false);

    if (!result.ok || !result.user) {
      toast({
        title: dialogMode === "create" ? "تعذر إنشاء المستخدم" : "تعذر تحديث المستخدم",
        description: result.error ?? "حدث خطأ غير متوقع.",
        variant: "destructive",
      });
      return;
    }

    const selectedSubjectCount = selectedSubjectIds.length;
    const subjectSyncError = await syncUserSubjectMappings(result.user, formState.role);

    await refreshDirectoryUsers();
    setDialogOpen(false);
    setFilter(result.user.role);
    setQuery(result.user.fullName);

    toast({
      title: dialogMode === "create" ? "تم إنشاء المستخدم" : "تم تحديث المستخدم",
      description:
        dialogMode === "create"
          ? `أضيف ${result.user.fullName} بنجاح إلى النظام.`
          : `تم تحديث بيانات ${result.user.fullName} بنجاح.`,
    });

    if (subjectSyncError) {
      toast({
        title: "تعذر مزامنة المواد",
        description: `${subjectSyncError} تم حفظ المستخدم لكن تحقق من ربط المواد.`,
        variant: "destructive",
      });
      return;
    }

    if (selectedSubjectCount > 0 && formState.role !== "admin") {
      toast({
        title: "تم ربط المواد",
        description: `تم ربط ${result.user.fullName} بعدد ${selectedSubjectCount} مواد.`,
      });
      return;
    }

    if (formState.role !== "admin") {
      toast({
        title: "لا توجد مواد مربوطة بعد",
        description: `تم حفظ ${result.user.fullName} بدون مواد عامة. اربطه بالمواد من هذه الشاشة أو من إدارة المواد حتى تظهر له العمليات الصحيحة.`,
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) {
      return;
    }

    if (!canManageUsers) {
      toast({
        title: "الإدارة غير متاحة",
        description: "يجب تشغيل Supabase الحقيقي لإدارة المستخدمين من هذه الشاشة.",
        variant: "destructive",
      });
      return;
    }

    setDeletingUserId(deleteTarget.id);
    const result = await deleteSupabaseAdminUser({ userId: deleteTarget.id });
    setDeletingUserId(null);

    if (!result.ok) {
      toast({
        title: "تعذر حذف المستخدم",
        description: result.error ?? "حدث خطأ غير متوقع أثناء حذف المستخدم.",
        variant: "destructive",
      });
      return;
    }

    const deletedName = deleteTarget.fullName;
    const impactParts = [
      result.impactSummary?.assignments ? `تكليفات ${result.impactSummary.assignments}` : "",
      result.impactSummary?.submissions ? `تسليمات ${result.impactSummary.submissions}` : "",
      result.impactSummary?.reviews ? `مراجعات ${result.impactSummary.reviews}` : "",
      result.impactSummary?.teacher_subjects ? `روابط معلم ${result.impactSummary.teacher_subjects}` : "",
      result.impactSummary?.teacher_departments ? `أقسام معلم ${result.impactSummary.teacher_departments}` : "",
      result.impactSummary?.student_subjects ? `روابط طالب ${result.impactSummary.student_subjects}` : "",
      result.impactSummary?.notification_reads ? `سجل قراءة إشعارات ${result.impactSummary.notification_reads}` : "",
    ].filter(Boolean);
    await refreshDirectoryUsers();
    setDeleteTarget(null);
    setQuery("");

    toast({
      title: "تم حذف المستخدم",
      description: impactParts.length > 0
        ? `تم حذف ${deletedName} بنجاح من النظام، مع حذف أو تنظيف البيانات المرتبطة التالية: ${impactParts.join("، ")}.`
        : `تم حذف ${deletedName} بنجاح من النظام.`,
    });
  };

  const applyMetricFilter = (nextFilter: UserFilter) => {
    setQuery("");
    setFilter(nextFilter);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-h1 font-bold">إدارة المستخدمين</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            عرض المستخدمين الحاليين، والبحث حسب الدور، وإنشاء الحسابات الجديدة وتحديثها أو حذفها من نفس الشاشة.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            مصدر البيانات الحالي: {authMode === "supabase" ? "Supabase" : "محلي تجريبي"}
          </p>
        </div>

        <Button
          variant="outline"
          className="gap-2 rounded-xl"
          disabled={!canManageUsers}
          onClick={openCreateDialog}
        >
          <Plus className="h-4 w-4" />
          إضافة مستخدم
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="إجمالي المستخدمين"
          value={directoryUsers.length}
          icon={Users}
          onClick={() => applyMetricFilter("all")}
          active={filter === "all"}
        />
        <StatCard
          title="الطلاب"
          value={userMetrics.students}
          icon={GraduationCap}
          onClick={() => applyMetricFilter("student")}
          active={filter === "student"}
        />
        <StatCard
          title="المعلمون"
          value={userMetrics.teachers}
          icon={Users}
          onClick={() => applyMetricFilter("teacher")}
          active={filter === "teacher"}
        />
        <StatCard
          title="تغيير كلمة المرور"
          value={userMetrics.passwordResetRequired}
          icon={KeyRound}
          onClick={() => applyMetricFilter("password")}
          active={filter === "password"}
        />
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم أو البريد أو المعرّف أو القسم..."
              className="h-10 rounded-xl pr-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "الكل" },
              { key: "student", label: "طلاب" },
              { key: "teacher", label: "معلمون" },
              { key: "admin", label: "مسؤولون" },
              { key: "password", label: "تغيير كلمة المرور" },
            ].map((item) => (
              <Button
                key={item.key}
                type="button"
                variant={filter === item.key ? "default" : "outline"}
                className="h-9 rounded-xl text-xs"
                onClick={() => setFilter(item.key as UserFilter)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 px-5 text-right font-medium text-muted-foreground">الاسم</th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground md:table-cell">
                  المعرّف
                </th>
                <th className="p-3 text-right font-medium text-muted-foreground">الدور</th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground lg:table-cell">
                  المسمى
                </th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground xl:table-cell">
                  القسم
                </th>
                <th className="p-3 text-right font-medium text-muted-foreground">الحالة</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((account) => (
                <tr
                  key={account.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-muted/50"
                >
                  <td className="p-3 px-5">
                    <div>
                      <p className="font-medium">{account.fullName}</p>
                      <p className="text-xs text-muted-foreground">{account.email}</p>
                    </div>
                  </td>
                  <td className="hidden p-3 tabular-nums text-muted-foreground md:table-cell">
                    {getIdentifier(account)}
                  </td>
                  <td className="p-3">
                    <StatusBadge
                      variant={getRoleBadgeVariant(account.role)}
                      label={getRoleLabel(account.role)}
                    />
                  </td>
                  <td className="hidden p-3 text-muted-foreground lg:table-cell">
                    {account.roleTitle || "-"}
                  </td>
                  <td className="hidden p-3 text-muted-foreground xl:table-cell">
                    {account.department || "-"}
                  </td>
                  <td className="p-3">
                    {account.mustChangePassword ? (
                      <StatusBadge variant="review" label="يتطلب تغيير كلمة المرور" />
                    ) : (
                      <StatusBadge variant="accepted" label="نشط" />
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1 rounded-lg text-xs"
                        disabled={!canManageUsers}
                        onClick={() => openEditDialog(account)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        تعديل
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1 rounded-lg text-xs text-destructive hover:text-destructive"
                        disabled={!canManageUsers}
                        onClick={() => openDeleteDialog(account)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
            <ShieldCheck className="h-8 w-8 text-muted-foreground/70" />
            <p>لا توجد نتائج مطابقة للبحث أو الفلتر المحدد.</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden rounded-2xl p-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 px-6 pt-6 text-right">
              <UserCog className="h-5 w-5" />
              {dialogMode === "create" ? "إضافة مستخدم جديد" : "تعديل بيانات المستخدم"}
            </DialogTitle>
            <DialogDescription className="px-6 text-right">
              {dialogMode === "create"
                ? "سيتم إنشاء الحساب في نظام المصادقة، ثم إنشاء صف profile وربطه مباشرة بالنظام."
                : "سيتم تحديث بيانات المستخدم في المصادقة والملف الشخصي مع الحفاظ على التكامل بينهما."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="full-name">الاسم الكامل</Label>
                <Input
                  id="full-name"
                  className="h-11 rounded-xl"
                  value={formState.fullName}
                  onChange={(event) => updateFormState("fullName", event.target.value)}
                  placeholder="مثال: محمد أحمد القحطاني"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  className="h-11 rounded-xl"
                  value={formState.email}
                  onChange={(event) => updateFormState("email", event.target.value)}
                  placeholder="name@university.edu"
                />
              </div>

              <div className="space-y-2">
                <Label>الدور</Label>
                <Select value={formState.role} onValueChange={(value) => handleRoleChange(value as UserRole)}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">طالب</SelectItem>
                    <SelectItem value="teacher">معلم</SelectItem>
                    <SelectItem value="admin">مسؤول</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="identifier">{identifierLabel}</Label>
                <Input
                  id="identifier"
                  className="h-11 rounded-xl"
                  value={formState.identifier}
                  onChange={(event) => updateFormState("identifier", event.target.value)}
                  placeholder={identifierPlaceholder}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  {dialogMode === "create" ? "كلمة المرور المؤقتة" : "كلمة مرور جديدة اختيارية"}
                </Label>
                <Input
                  id="password"
                  type="text"
                  className="h-11 rounded-xl"
                  value={formState.password}
                  onChange={(event) => updateFormState("password", event.target.value)}
                  placeholder={dialogMode === "create" ? "TempPass@123" : "اتركها فارغة إذا لم ترد تغييرها"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role-title">المسمى</Label>
                <Input
                  id="role-title"
                  className="h-11 rounded-xl"
                  value={formState.roleTitle}
                  onChange={(event) => updateFormState("roleTitle", event.target.value)}
                  placeholder="عضو هيئة التدريس"
                />
              </div>
            </div>

            {formState.role !== "admin" && (
              <div className="mb-4 space-y-4 rounded-2xl border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {formState.role === "teacher" ? "المسارات الأكاديمية للمعلم" : "المسارات الأكاديمية للطالب"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formState.role === "teacher"
                        ? "اختر قسماً ومستوى وفصلاً، ثم فعّل عدة مواد من نفس المسار. يمكنك إضافة أكثر من مسار إذا كان المعلم يدرّس أكثر من مستوى أو قسم. أول مسار يعتبر المسار الأساسي لملف المعلم."
                        : "اختر قسماً ومستوى وفصلاً، ثم فعّل المواد التي يدرسها الطالب. أول مسار يعتبر المسار الأساسي لملف الطالب."}
                    </p>
                  </div>

                  <Button type="button" variant="outline" className="gap-2 rounded-xl" onClick={addAcademicScope}>
                    <Plus className="h-4 w-4" />
                    إضافة مسار
                  </Button>
                </div>

                <div className="space-y-4">
                  {academicScopes.map((scope, index) => {
                    const scopeOptions = getSubjectOptionsForScope(scope);
                    const allScopeSubjectsSelected =
                      scopeOptions.length > 0 && scopeOptions.every((subject) => scope.subjectIds.includes(subject.id));
                    const someScopeSubjectsSelected =
                      scopeOptions.some((subject) => scope.subjectIds.includes(subject.id)) && !allScopeSubjectsSelected;

                    return (
                      <div key={scope.id} className="space-y-3 rounded-2xl border border-border/70 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {formState.role === "teacher" ? "مسار تدريس" : "مسار دراسة"} {index + 1}
                              {index === 0 ? " (أساسي)" : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {scope.subjectIds.length > 0
                                ? `تم اختيار ${scope.subjectIds.length} مواد في هذا المسار.`
                                : "حدد المواد التي تنتمي إلى هذا المسار."}
                            </p>
                          </div>

                          {academicScopes.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-1 rounded-lg text-destructive hover:text-destructive"
                              onClick={() => removeAcademicScope(scope.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              حذف المسار
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label>القسم</Label>
                            <Select
                              value={scope.department || undefined}
                              onValueChange={(value) => updateAcademicScope(scope.id, "department", value)}
                            >
                              <SelectTrigger className="h-11 rounded-xl">
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
                            <Label>المستوى</Label>
                            <Select
                              value={scope.level || undefined}
                              onValueChange={(value) => updateAcademicScope(scope.id, "level", value)}
                            >
                              <SelectTrigger className="h-11 rounded-xl">
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
                            <Label>الفصل</Label>
                            <Select
                              value={scope.semester || undefined}
                              onValueChange={(value) => updateAcademicScope(scope.id, "semester", value)}
                            >
                              <SelectTrigger className="h-11 rounded-xl">
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

                        {scopeOptions.length > 0 ? (
                          <div className="space-y-3">
                            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium">تحديد كل مواد هذا المسار</p>
                                <p className="text-xs text-muted-foreground">
                                  {allScopeSubjectsSelected
                                    ? "كل المواد المعروضة محددة الآن."
                                    : someScopeSubjectsSelected
                                      ? "بعض المواد محددة. يمكنك تفعيل هذا المربع لاختيار الكل."
                                      : "حدد كل المواد الظاهرة لهذا القسم والمستوى والفصل بضغطة واحدة."}
                                </p>
                              </div>
                              <Checkbox
                                checked={allScopeSubjectsSelected ? true : someScopeSubjectsSelected ? "indeterminate" : false}
                                onCheckedChange={(value) =>
                                  setScopeSubjectSelections(
                                    scope.id,
                                    value === true ? scopeOptions.map((subject) => subject.id) : [],
                                  )}
                                aria-label="تحديد كل مواد هذا المسار"
                              />
                            </label>

                            <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                              {scopeOptions.map((subject) => {
                                const checked = scope.subjectIds.includes(subject.id);

                                return (
                                  <label
                                    key={`${scope.id}-${subject.id}`}
                                    className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3"
                                  >
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium">
                                        {subject.nameAr}
                                        {subject.code ? ` - ${subject.code}` : ""}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {subject.department || "بدون قسم"}
                                        {subject.level ? ` • ${subject.level}` : ""}
                                        {subject.semester ? ` • ${subject.semester}` : ""}
                                      </p>
                                    </div>
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(value) => toggleScopeSubjectSelection(scope.id, subject.id, value === true)}
                                      aria-label={`اختيار مادة ${subject.nameAr}`}
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            لا توجد مواد نشطة مطابقة لهذا القسم والمستوى والفصل. أضف المواد أولًا من شاشة المواد أو غيّر المسار.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="flex items-start justify-between gap-4 rounded-2xl border border-border p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">إجبار المستخدم على تغيير كلمة المرور</p>
                <p className="text-xs text-muted-foreground">
                  سيظهر للمستخدم مسار تغيير كلمة المرور قبل متابعة استخدام المنصة.
                </p>
              </div>
              <input
                type="checkbox"
                checked={formState.forcePasswordChange}
                onChange={(event) => updateFormState("forcePasswordChange", event.target.checked)}
                className="mt-1 h-4 w-4"
              />
            </label>
          </div>

          <DialogFooter className="gap-2 border-t border-border bg-background px-6 py-4 sm:space-x-0">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button type="button" className="rounded-xl" disabled={submitting} onClick={() => void handleSaveUser()}>
              {submitting
                ? dialogMode === "create" ? "جارٍ الإنشاء..." : "جارٍ الحفظ..."
                : dialogMode === "create" ? "إنشاء المستخدم" : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>حذف المستخدم</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `سيتم حذف حساب ${deleteTarget.fullName} نهائيًا. إذا كانت له تكليفات أو تسليمات أو مراجعات أو روابط مواد، فسيتم حذف البيانات التابعة له أو فك مراجعها تلقائيًا حسب إعدادات قاعدة البيانات.`
                : "سيتم حذف هذا المستخدم نهائيًا، وقد تُحذف معه بياناته التابعة أو تُفك مراجعها تلقائيًا حسب نوع الارتباط."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingUserId !== null}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteUser();
              }}
            >
              {deletingUserId ? "جارٍ الحذف..." : "تأكيد الحذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



