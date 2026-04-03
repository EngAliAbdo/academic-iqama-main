import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleHome, getRoleLabel } from "@/lib/auth";

type Role = "student" | "teacher" | "admin";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AppLayoutProps {
  role: Role;
  breadcrumbs?: BreadcrumbItem[];
}

const ROUTE_LABELS: Record<string, string> = {
  "/student": "لوحة التحكم",
  "/student/subjects": "المواد الدراسية",
  "/student/assignments": "التكليفات",
  "/student/upload": "رفع تكليف",
  "/student/status": "حالة التسليم",
  "/student/originality": "الأصالة",
  "/student/grades": "الدرجات والتقييم",
  "/student/history": "السجل",
  "/student/calendar": "التقويم",
  "/teacher": "لوحة التحكم",
  "/teacher/create-assignment": "إنشاء تكليف",
  "/teacher/assignments": "إدارة التكليفات",
  "/teacher/submissions": "صندوق التسليمات",
  "/teacher/review": "مراجعة التسليم",
  "/teacher/analytics": "التحليلات",
  "/teacher/reports": "قضايا الأصالة",
  "/admin": "لوحة التحكم",
  "/admin/users": "إدارة المستخدمين",
  "/admin/roles": "الأدوار والصلاحيات",
  "/admin/subjects": "المواد والهيكل",
  "/admin/activity": "سجل النشاطات",
  "/admin/reports": "قضايا الأصالة",
  "/admin/settings": "إعدادات النظام",
  "/notifications": "الإشعارات",
  "/profile": "الملف الشخصي",
  "/settings": "الإعدادات",
};

function shortenBreadcrumbLabel(value?: string) {
  if (!value) {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 26 ? `${normalized.slice(0, 26)}...` : normalized;
}

export function AppLayout({ role, breadcrumbs }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { getAssignmentById, getSubmissionById } = useAcademicData();
  const effectiveRole = user?.role ?? role;

  const resolvedBreadcrumbs = useMemo(() => {
    const rootLabel = user ? getRoleLabel(user.role) : breadcrumbs?.[0]?.label ?? getRoleLabel(effectiveRole);
    const rootHref = getRoleHome(effectiveRole);
    const pageLabel = ROUTE_LABELS[location.pathname];
    const urlSearch = new URLSearchParams(location.search);
    const assignmentId = urlSearch.get("assignment");
    const submissionId = urlSearch.get("submission");
    const assignment = assignmentId ? getAssignmentById(assignmentId) : undefined;
    const submission = submissionId ? getSubmissionById(submissionId) : undefined;
    const submissionAssignment = submission ? getAssignmentById(submission.assignmentId) : undefined;
    const detailLabel = shortenBreadcrumbLabel(assignment?.title ?? submissionAssignment?.title);

    const items: BreadcrumbItem[] = [{ label: rootLabel, href: rootHref }];

    if (pageLabel) {
      items.push({ label: pageLabel });
    }

    if (detailLabel && detailLabel !== pageLabel && detailLabel !== rootLabel) {
      items.push({ label: detailLabel });
    }

    return items;
  }, [breadcrumbs, effectiveRole, getAssignmentById, getSubmissionById, location.pathname, location.search, user]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar role={effectiveRole} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar breadcrumbs={resolvedBreadcrumbs} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
