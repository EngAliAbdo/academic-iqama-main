import { useEffect, useMemo, type ElementType } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building,
  Calendar,
  ChevronRight,
  Clock,
  FileBarChart,
  FilePlus,
  FileText,
  GraduationCap,
  History,
  Inbox,
  LayoutDashboard,
  ScanSearch,
  Settings,
  Shield,
  Upload,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationsContext } from "@/contexts/NotificationsContext";
import { getRoleLabel } from "@/lib/auth";
import { isAnalysisPending, isSuspiciousSubmission } from "@/lib/academic-data";
import { cn } from "@/lib/utils";

type Role = "student" | "teacher" | "admin";

interface NavItem {
  label: string;
  href: string;
  icon: ElementType;
  badgeCount?: number;
}

interface AppSidebarProps {
  role: Role;
  open: boolean;
  onClose: () => void;
}

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function SidebarBadge({ count }: { count?: number }) {
  if (!count) {
    return null;
  }

  return (
    <span className="mr-auto inline-flex min-w-6 items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
      {formatBadgeCount(count)}
    </span>
  );
}

export function AppSidebar({ role, open, onClose }: AppSidebarProps) {
  const { user, directoryUsers } = useAuth();
  const { unreadCount } = useNotificationsContext();
  const {
    activityFeed,
    submissions,
    getStudentAssignments,
    getStudentSubmissions,
    getTeacherSubmissions,
  } = useAcademicData();

  const counts = useMemo(() => {
    if (!user) {
      return {
        adminCases: 0,
        adminUsersAttention: 0,
        studentFollowUp: 0,
        studentPendingUploads: 0,
        teacherCases: 0,
        teacherInbox: 0,
      };
    }

    const studentAssignments = user.role === "student" ? getStudentAssignments(user.id) : [];
    const studentSubmissions = user.role === "student" ? getStudentSubmissions(user.id) : [];
    const teacherSubmissions = user.role === "teacher" ? getTeacherSubmissions(user.id) : [];
    const studentPendingUploads = studentAssignments.filter(
      (assignment) => !studentSubmissions.some((submission) => submission.assignmentId === assignment.id),
    ).length;
    const studentFollowUp = studentSubmissions.filter(
      (submission) =>
        isAnalysisPending(submission.analysisStatus)
        || submission.analysisStatus === "manual_review_required"
        || submission.status === "review"
        || submission.status === "revision",
    ).length;
    const teacherInbox = teacherSubmissions.filter(
      (submission) =>
        submission.status === "submitted"
        || submission.status === "review"
        || submission.status === "revision"
        || isAnalysisPending(submission.analysisStatus)
        || submission.analysisStatus === "manual_review_required",
    ).length;
    const teacherCases = teacherSubmissions.filter(isSuspiciousSubmission).length;
    const adminCases = submissions.filter(isSuspiciousSubmission).length;
    const adminUsersAttention = directoryUsers.filter((account) => account.mustChangePassword).length;

    return {
      adminCases,
      adminUsersAttention,
      studentFollowUp,
      studentPendingUploads,
      teacherCases,
      teacherInbox,
    };
  }, [
    directoryUsers,
    getStudentAssignments,
    getStudentSubmissions,
    getTeacherSubmissions,
    submissions,
    user,
  ]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const items = useMemo<NavItem[]>(() => {
    if (role === "student") {
      return [
        { label: "لوحة التحكم", href: "/student", icon: LayoutDashboard },
        { label: "المواد الدراسية", href: "/student/subjects", icon: BookOpen },
        { label: "التكليفات", href: "/student/assignments", icon: FileText },
        {
          label: "رفع تكليف",
          href: "/student/upload",
          icon: Upload,
          badgeCount: counts.studentPendingUploads,
        },
        {
          label: "حالة التسليم",
          href: "/student/status",
          icon: Clock,
          badgeCount: counts.studentFollowUp,
        },
        { label: "الأصالة", href: "/student/originality", icon: ScanSearch },
        { label: "الدرجات والتقييم", href: "/student/grades", icon: Award },
        { label: "السجل", href: "/student/history", icon: History },
        { label: "التقويم", href: "/student/calendar", icon: Calendar },
      ];
    }

    if (role === "teacher") {
      return [
        { label: "لوحة التحكم", href: "/teacher", icon: LayoutDashboard },
        { label: "إنشاء تكليف", href: "/teacher/create-assignment", icon: FilePlus },
        { label: "إدارة التكليفات", href: "/teacher/assignments", icon: FileText },
        {
          label: "صندوق التسليمات",
          href: "/teacher/submissions",
          icon: Inbox,
          badgeCount: counts.teacherInbox,
        },
        { label: "مراجعة التسليم", href: "/teacher/review", icon: ScanSearch },
        { label: "التحليلات", href: "/teacher/analytics", icon: BarChart3 },
        {
          label: "قضايا الأصالة",
          href: "/teacher/reports",
          icon: FileBarChart,
          badgeCount: counts.teacherCases,
        },
      ];
    }

    return [
      { label: "لوحة التحكم", href: "/admin", icon: LayoutDashboard },
      {
        label: "إدارة المستخدمين",
        href: "/admin/users",
        icon: Users,
        badgeCount: counts.adminUsersAttention,
      },
      { label: "الأدوار والصلاحيات", href: "/admin/roles", icon: Shield },
      { label: "المواد والهيكل", href: "/admin/subjects", icon: Building },
      {
        label: "سجل النشاطات",
        href: "/admin/activity",
        icon: Activity,
        badgeCount: activityFeed.filter((item) => item.priority !== "normal").length,
      },
      {
        label: "قضايا الأصالة",
        href: "/admin/reports",
        icon: BarChart3,
        badgeCount: counts.adminCases,
      },
      { label: "إعدادات النظام", href: "/admin/settings", icon: Settings },
    ];
  }, [activityFeed, counts, role]);

  const accountItems: NavItem[] = [
    { href: "/profile", label: "الملف الشخصي", icon: UserCircle },
    { href: "/notifications", label: "الإشعارات", icon: Bell, badgeCount: unreadCount },
    { href: "/settings", label: "الإعدادات", icon: Settings },
  ];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-screen w-64 shrink-0 flex-col border-l border-border bg-card transition-transform duration-300 lg:sticky lg:top-0 lg:self-start lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-border p-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="rounded-xl bg-primary p-2">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">نظام التحقق</p>
              <p className="text-xs text-muted-foreground">{getRoleLabel(role)}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-muted lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeClassName="bg-primary/10 text-primary"
            >
              {({ isActive }) => (
                <>
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                  <span>{item.label}</span>
                  <SidebarBadge count={item.badgeCount} />
                  {isActive && <ChevronRight className="h-4 w-4 rotate-180" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-border p-3">
          <p className="mb-2 px-3 text-xs text-muted-foreground">الحساب</p>
          {accountItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeClassName="bg-primary/10 text-primary"
            >
              {({ isActive }) => (
                <>
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                  <SidebarBadge count={item.badgeCount} />
                  {isActive && <ChevronRight className="h-3.5 w-3.5 rotate-180" />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </aside>
    </>
  );
}
