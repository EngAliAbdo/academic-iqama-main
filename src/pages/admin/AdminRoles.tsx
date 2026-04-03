import { useDeferredValue, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  GraduationCap,
  KeyRound,
  Search,
  Shield,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { roleCapabilities, roleLabels } from "@/lib/role-capabilities";
import type { AuthUser, UserRole } from "@/lib/auth";

const roleOrder: UserRole[] = ["student", "teacher", "admin"];

type RoleFilter = "all" | UserRole | "password";

function getRoleBadgeVariant(role: UserRole) {
  return ({
    student: "submitted",
    teacher: "published",
    admin: "accepted",
  } as const)[role];
}

function getIdentifierLabel(role: UserRole) {
  return role === "student" ? "الرقم الأكاديمي" : "رقم الموظف";
}

function getUserIdentifier(user: AuthUser) {
  return user.academicId || user.email;
}

function matchesFilter(user: AuthUser, filter: RoleFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "password") {
    return user.mustChangePassword;
  }

  return user.role === filter;
}

export default function AdminRoles() {
  const { authMode, directoryUsers } = useAuth();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RoleFilter>("all");
  const deferredQuery = useDeferredValue(query);

  const roleMetrics = useMemo(() => {
    const counts = roleOrder.reduce(
      (accumulator, role) => ({
        ...accumulator,
        [role]: directoryUsers.filter((user) => user.role === role).length,
      }),
      {} as Record<UserRole, number>,
    );

    const passwordResetRequired = directoryUsers.filter((user) => user.mustChangePassword).length;

    return { counts, passwordResetRequired };
  }, [directoryUsers]);

  const roleWarnings = useMemo(() => {
    const warnings: Array<{
      id: string;
      title: string;
      description: string;
      variant: "accepted" | "review" | "flagged";
    }> = [];

    if (roleMetrics.counts.admin === 0) {
      warnings.push({
        id: "missing-admin",
        title: "لا يوجد مسؤول نشط",
        description: "ينبغي وجود حساب إدارة واحد على الأقل لمتابعة الإعدادات والقضايا النظامية.",
        variant: "flagged",
      });
    }

    if (roleMetrics.counts.teacher === 0) {
      warnings.push({
        id: "missing-teacher",
        title: "لا يوجد معلمون مرتبطون",
        description: "بوابة المعلم لن تكون قابلة للاستخدام دون حسابات معلمين فعلية.",
        variant: "review",
      });
    }

    if (roleMetrics.counts.student === 0) {
      warnings.push({
        id: "missing-student",
        title: "لا يوجد طلاب مفعّلون",
        description: "مسار الرفع والتحليل الحي يحتاج طلابًا فعليين مرتبطين بالمنصة.",
        variant: "review",
      });
    }

    if (roleMetrics.passwordResetRequired > 0) {
      warnings.push({
        id: "password-reset",
        title: "توجد حسابات تحتاج تحديث كلمة المرور",
        description: `يوجد ${roleMetrics.passwordResetRequired} حساب بانتظار تغيير كلمة المرور الأولى.`,
        variant: "accepted",
      });
    }

    return warnings;
  }, [roleMetrics]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

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
          getUserIdentifier(user),
          roleLabels[user.role],
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => left.fullName.localeCompare(right.fullName, "ar"));
  }, [deferredQuery, directoryUsers, filter]);

  const applyMetricFilter = (nextFilter: RoleFilter) => {
    setQuery("");
    setFilter(nextFilter);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-h1 font-bold">الأدوار والصلاحيات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            متابعة توزيع الحسابات الحالية حسب الدور، مع عرض سريع للتغطية التشغيلية ومصفوفة الصلاحيات المعتمدة.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            مصدر البيانات الحالي: {authMode === "supabase" ? "Supabase" : "محلي تجريبي"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="الطلاب"
          value={roleMetrics.counts.student}
          icon={GraduationCap}
          onClick={() => applyMetricFilter("student")}
          active={filter === "student"}
        />
        <StatCard
          title="المعلمون"
          value={roleMetrics.counts.teacher}
          icon={Users}
          onClick={() => applyMetricFilter("teacher")}
          active={filter === "teacher"}
        />
        <StatCard
          title="المسؤولون"
          value={roleMetrics.counts.admin}
          icon={Shield}
          onClick={() => applyMetricFilter("admin")}
          active={filter === "admin"}
        />
        <StatCard
          title="يتطلب تغيير كلمة المرور"
          value={roleMetrics.passwordResetRequired}
          icon={KeyRound}
          onClick={() => applyMetricFilter("password")}
          active={filter === "password"}
        />
      </div>

      <section className="rounded-2xl bg-card p-5 shadow-card">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">مراجعة التغطية التشغيلية</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          تنبيهات مبنية على وجود الحسابات الحالية داخل النظام، وتساعد على اكتشاف أي نقص قبل التشغيل الفعلي.
        </p>

        {roleWarnings.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {roleWarnings.map((warning) => (
              <div
                key={warning.id}
                className="rounded-xl border border-border bg-muted/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{warning.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{warning.description}</p>
                  </div>
                  <StatusBadge
                    variant={warning.variant}
                    label={
                      warning.variant === "flagged"
                        ? "حرج"
                        : warning.variant === "review"
                          ? "تنبيه"
                          : "متابعة"
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
            تغطية الأدوار الأساسية سليمة حاليًا، ولا توجد فجوات واضحة في وجود حسابات الطالب والمعلم والإدارة.
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-card p-5 shadow-card">
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
                onClick={() => setFilter(item.key as RoleFilter)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        {filteredUsers.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 px-4 text-right font-medium text-muted-foreground">الحساب</th>
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
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="p-3 px-4">
                      <p className="font-medium">{user.fullName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="hidden p-3 md:table-cell">
                      <div>
                        <p className="font-medium">{getUserIdentifier(user)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {getIdentifierLabel(user.role)}
                        </p>
                      </div>
                    </td>
                    <td className="p-3">
                      <StatusBadge
                        variant={getRoleBadgeVariant(user.role)}
                        label={roleLabels[user.role]}
                      />
                    </td>
                    <td className="hidden p-3 text-muted-foreground lg:table-cell">
                      {user.roleTitle}
                    </td>
                    <td className="hidden p-3 text-muted-foreground xl:table-cell">
                      {user.department || "-"}
                    </td>
                    <td className="p-3">
                      {user.mustChangePassword ? (
                        <StatusBadge variant="review" label="بانتظار التحديث" />
                      ) : (
                        <StatusBadge variant="accepted" label="نشط" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            className="py-12"
            icon={<AlertTriangle className="h-8 w-8 text-muted-foreground" />}
            title="لا توجد نتائج مطابقة"
            description="جرّب تغيير البحث أو الفلتر لعرض الحسابات الحالية ضمن الدور المطلوب."
          />
        )}
      </section>

      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">مصفوفة الصلاحيات</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            هذه المصفوفة تعكس نطاق الوصول الحالي لكل دور داخل صفحات النظام ومسار العمل.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 px-5 text-right font-medium text-muted-foreground">الصلاحية</th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground lg:table-cell">
                  الوصف
                </th>
                {roleOrder.map((role) => (
                  <th key={role} className="p-3 text-center font-medium text-muted-foreground">
                    {roleLabels[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roleCapabilities.map((capability) => (
                <tr
                  key={capability.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="p-3 px-5">
                    <p className="font-medium">{capability.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground lg:hidden">
                      {capability.description}
                    </p>
                  </td>
                  <td className="hidden p-3 text-muted-foreground lg:table-cell">
                    {capability.description}
                  </td>
                  {roleOrder.map((role) => (
                    <td key={role} className="p-3 text-center">
                      {capability.access[role] ? (
                        <span className="inline-flex rounded-full bg-success/10 p-2 text-success">
                          <Check className="h-4 w-4" />
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-muted p-2 text-muted-foreground/50">
                          <X className="h-4 w-4" />
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
