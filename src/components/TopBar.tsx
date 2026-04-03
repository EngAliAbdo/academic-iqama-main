import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  ChevronLeft,
  Clock3,
  FileBarChart,
  FilePlus,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ScanSearch,
  Search,
  Settings,
  Sun,
  Upload,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useNotificationsContext } from "@/contexts/NotificationsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/use-theme";
import { getRoleHome, getRoleLabel, type UserRole } from "@/lib/auth";
import { getOriginalityRiskLevel } from "@/lib/academic-data";
import { cn } from "@/lib/utils";

interface TopBarProps {
  breadcrumbs?: { label: string; href?: string }[];
  onMenuClick: () => void;
}

interface SearchItem {
  id: string;
  title: string;
  description: string;
  href: string;
  kindLabel: string;
  icon: ElementType;
  searchText: string;
}

const SEARCH_HISTORY_STORAGE_PREFIX = "academic-iqama.search-history";

function buildSearchText(parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
}

function formatCounterLabel(count: number) {
  return count > 9 ? "+9" : String(count);
}

function getSearchHistoryStorageKey(userId: string) {
  return `${SEARCH_HISTORY_STORAGE_PREFIX}.${userId}`;
}

function getRoleShortcutItems(role: UserRole): Array<Omit<SearchItem, "searchText">> {
  if (role === "student") {
    return [
      {
        id: "nav-student-assignments",
        title: "التكليفات",
        description: "عرض التكليفات المنشورة والانتقال السريع إلى الرفع أو المتابعة",
        href: "/student/assignments",
        kindLabel: "تنقل",
        icon: FileText,
      },
      {
        id: "nav-student-upload",
        title: "رفع تكليف",
        description: "الانتقال إلى صفحة تسليم الملفات ورفع نسخة جديدة",
        href: "/student/upload",
        kindLabel: "تنقل",
        icon: Upload,
      },
      {
        id: "nav-student-status",
        title: "حالة التسليم",
        description: "متابعة حالة التحليل والتقييم وآخر تحديثات التسليم",
        href: "/student/status",
        kindLabel: "تنقل",
        icon: Clock3,
      },
      {
        id: "nav-student-originality",
        title: "الأصالة",
        description: "عرض ملخص نتائج الأصالة الآمنة للتسليمات",
        href: "/student/originality",
        kindLabel: "تنقل",
        icon: ScanSearch,
      },
    ];
  }

  if (role === "teacher") {
    return [
      {
        id: "nav-teacher-create",
        title: "إنشاء تكليف",
        description: "إضافة تكليف جديد وربطه بالمادة والسياسات الحالية",
        href: "/teacher/create-assignment",
        kindLabel: "تنقل",
        icon: FilePlus,
      },
      {
        id: "nav-teacher-assignments",
        title: "إدارة التكليفات",
        description: "استعراض التكليفات الحالية والمرفقات وحالة النشر",
        href: "/teacher/assignments",
        kindLabel: "تنقل",
        icon: FileText,
      },
      {
        id: "nav-teacher-submissions",
        title: "صندوق التسليمات",
        description: "عرض كل التسليمات الواردة وفرزها حسب الحالة",
        href: "/teacher/submissions",
        kindLabel: "تنقل",
        icon: Inbox,
      },
      {
        id: "nav-teacher-reports",
        title: "قضايا الأصالة",
        description: "متابعة الحالات المشبوهة والمتوسطة وعناصر المراجعة",
        href: "/teacher/reports",
        kindLabel: "تنقل",
        icon: FileBarChart,
      },
    ];
  }

  return [
    {
      id: "nav-admin-users",
      title: "إدارة المستخدمين",
      description: "استعراض الحسابات الحالية وحالات كلمة المرور الأولى",
      href: "/admin/users",
      kindLabel: "تنقل",
      icon: Users,
    },
    {
      id: "nav-admin-activity",
      title: "سجل النشاطات",
      description: "مراقبة العمليات الحساسة والتغييرات الأخيرة في النظام",
      href: "/admin/activity",
      kindLabel: "تنقل",
      icon: Clock3,
    },
    {
      id: "nav-admin-reports",
      title: "قضايا الأصالة",
      description: "عرض حالات الاشتباه والتحليلات التي تحتاج متابعة إدارية",
      href: "/admin/reports",
      kindLabel: "تنقل",
      icon: FileBarChart,
    },
    {
      id: "nav-admin-settings",
      title: "إعدادات النظام",
      description: "تعديل سياسة الرفع والحدود المؤسسية والتحليل",
      href: "/admin/settings",
      kindLabel: "تنقل",
      icon: Settings,
    },
  ];
}

function getRoleQuickAction(role: UserRole) {
  if (role === "student") {
    return {
      href: "/student/upload",
      label: "رفع تكليف",
      icon: Upload,
    };
  }

  if (role === "teacher") {
    return {
      href: "/teacher/create-assignment",
      label: "إنشاء تكليف",
      icon: FilePlus,
    };
  }

  return {
    href: "/admin/reports",
    label: "قضايا الأصالة",
    icon: FileBarChart,
  };
}

export function TopBar({ breadcrumbs = [], onMenuClick }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [recentSearchIds, setRecentSearchIds] = useState<string[]>([]);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotificationsContext();
  const { authMode, directoryUsers, user, signOut } = useAuth();
  const {
    assignments,
    submissions,
    getAssignmentById,
    getStudentAssignments,
    getStudentSubmissions,
    getTeacherAssignments,
    getTeacherSubmissions,
  } = useAcademicData();
  const navigate = useNavigate();
  const location = useLocation();
  const homeHref = user ? getRoleHome(user.role) : "/";
  const showBackButton = location.pathname !== homeHref;
  const currentPageTitle = breadcrumbs[breadcrumbs.length - 1]?.label ?? "النظام";
  const quickAction = getRoleQuickAction(user?.role ?? "student");

  const closeTransientUi = useCallback(() => {
    setSearchOpen(false);
    setUserMenuOpen(false);
    setSearchQuery("");
    setHighlightedIndex(0);
  }, []);

  useEffect(() => {
    closeTransientUi();
  }, [closeTransientUi, location.pathname, location.search]);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [searchOpen]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.title = `${currentPageTitle} | نظام التحقق الذكي من التكاليف الدراسية`;
  }, [currentPageTitle]);

  useEffect(() => {
    if (!user) {
      setRecentSearchIds([]);
      return;
    }

    const raw = localStorage.getItem(getSearchHistoryStorageKey(user.id));
    if (!raw) {
      setRecentSearchIds([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as string[];
      setRecentSearchIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRecentSearchIds([]);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    localStorage.setItem(
      getSearchHistoryStorageKey(user.id),
      JSON.stringify(recentSearchIds.slice(0, 6)),
    );
  }, [recentSearchIds, user]);

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
    navigate("/login");
  };

  const handleBack = useCallback(() => {
    if (!user) {
      navigate("/");
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(homeHref);
  }, [homeHref, navigate, user]);

  const searchItems = useMemo<SearchItem[]>(() => {
    if (!user) {
      return [];
    }

    const items: SearchItem[] = [
      {
        id: "nav-dashboard",
        title: "لوحة التحكم",
        description: "العودة إلى الصفحة الرئيسية الخاصة بدورك الحالي",
        href: getRoleHome(user.role),
        kindLabel: "تنقل",
        icon: LayoutDashboard,
        searchText: buildSearchText(["لوحة التحكم", "الرئيسية", user.role, user.fullName]),
      },
      {
        id: "nav-notifications",
        title: "الإشعارات",
        description:
          unreadCount > 0
            ? `عرض التنبيهات الحالية، لديك ${unreadCount} إشعارات غير مقروءة`
            : "عرض التنبيهات الحالية والإشعارات المقروءة",
        href: "/notifications",
        kindLabel: "تنقل",
        icon: Bell,
        searchText: buildSearchText(["الإشعارات", "التنبيهات", String(unreadCount)]),
      },
      {
        id: "nav-profile",
        title: "الملف الشخصي",
        description: "عرض بيانات الحساب والملف الشخصي",
        href: "/profile",
        kindLabel: "تنقل",
        icon: User,
        searchText: buildSearchText(["الملف الشخصي", "الحساب", user.fullName, user.academicId]),
      },
      {
        id: "nav-settings",
        title: "الإعدادات",
        description: "إعدادات الحساب والوضع الحالي للتطبيق",
        href: "/settings",
        kindLabel: "تنقل",
        icon: Settings,
        searchText: buildSearchText(["الإعدادات", "الإعدادات العامة", authMode]),
      },
      ...getRoleShortcutItems(user.role).map((item) => ({
        ...item,
        searchText: buildSearchText([item.title, item.description, item.kindLabel]),
      })),
    ];

    if (user.role === "student") {
      const studentAssignments = getStudentAssignments(user.id);
      const studentSubmissions = getStudentSubmissions(user.id);

      studentAssignments.forEach((assignment) => {
        items.push({
          id: `student-assignment-${assignment.id}`,
          title: assignment.title,
          description: `${assignment.subject} - الانتقال إلى صفحة الرفع أو متابعة التعليمات`,
          href: `/student/upload?assignment=${assignment.id}`,
          kindLabel: "تكليف",
          icon: Upload,
          searchText: buildSearchText([
            assignment.title,
            assignment.subject,
            assignment.instructions,
            assignment.description,
            "تكليف",
          ]),
        });
      });

      studentSubmissions.forEach((submission) => {
        const assignment = getAssignmentById(submission.assignmentId);
        items.push({
          id: `student-submission-${submission.id}`,
          title: assignment?.title ?? submission.fileName,
          description: `متابعة حالة التسليم - ${submission.fileName}`,
          href: `/student/status?assignment=${submission.assignmentId}`,
          kindLabel: "تسليم",
          icon: Clock3,
          searchText: buildSearchText([
            assignment?.title,
            assignment?.subject,
            submission.fileName,
            submission.status,
            submission.analysisStatus,
            "تسليم",
          ]),
        });

        items.push({
          id: `student-originality-${submission.id}`,
          title: `أصالة ${assignment?.title ?? "التسليم"}`,
          description: "عرض نتيجة الأصالة والملخص الآمن",
          href: `/student/originality?assignment=${submission.assignmentId}`,
          kindLabel: "أصالة",
          icon: ScanSearch,
          searchText: buildSearchText([
            "الأصالة",
            assignment?.title,
            assignment?.subject,
            submission.analysisStatus,
          ]),
        });
      });
    }

    if (user.role === "teacher") {
      const teacherAssignments = getTeacherAssignments(user.id);
      const teacherSubmissions = getTeacherSubmissions(user.id);

      teacherAssignments.forEach((assignment) => {
        items.push({
          id: `teacher-assignment-${assignment.id}`,
          title: assignment.title,
          description: `${assignment.subject} - استعراض حالة التكليف والمرفقات`,
          href: "/teacher/assignments",
          kindLabel: "تكليف",
          icon: FileText,
          searchText: buildSearchText([
            assignment.title,
            assignment.subject,
            assignment.description,
            assignment.instructions,
            "تكليف",
          ]),
        });
      });

      teacherSubmissions.forEach((submission) => {
        const assignment = getAssignmentById(submission.assignmentId);
        const riskLevel = getOriginalityRiskLevel(submission);

        items.push({
          id: `teacher-submission-${submission.id}`,
          title: `${submission.studentName} - ${assignment?.title ?? "تسليم"}`,
          description:
            riskLevel === "high"
              ? "حالة عالية الخطورة وتحتاج مراجعة تفصيلية"
              : riskLevel === "manual"
                ? "مراجعة يدوية مطلوبة بسبب تعذر التحليل الآلي"
                : "تسليم مرتبط بمادة المعلم ويمكن متابعته مباشرة",
          href: `/teacher/review?submission=${submission.id}`,
          kindLabel: riskLevel === "high" || riskLevel === "manual" ? "قضية" : "تسليم",
          icon: riskLevel === "high" || riskLevel === "manual" ? ScanSearch : Clock3,
          searchText: buildSearchText([
            submission.studentName,
            submission.academicId,
            assignment?.title,
            assignment?.subject,
            submission.fileName,
            submission.status,
            submission.analysisStatus,
            riskLevel,
          ]),
        });
      });
    }

    if (user.role === "admin") {
      directoryUsers.forEach((account) => {
        items.push({
          id: `admin-user-${account.academicId}`,
          title: account.fullName,
          description: `${account.roleTitle} - ${account.academicId}`,
          href: "/admin/users",
          kindLabel: "مستخدم",
          icon: User,
          searchText: buildSearchText([
            account.fullName,
            account.academicId,
            account.role,
            account.roleTitle,
          ]),
        });
      });

      submissions.forEach((submission) => {
        const assignment = assignments.find((item) => item.id === submission.assignmentId);
        const riskLevel = getOriginalityRiskLevel(submission);

        if (riskLevel === "low") {
          return;
        }

        items.push({
          id: `admin-case-${submission.id}`,
          title: `${submission.studentName} - ${assignment?.subject ?? "قضية أصالة"}`,
          description: `${assignment?.title ?? submission.fileName} - ${submission.analysisStatus}`,
          href: "/admin/reports",
          kindLabel: "قضية",
          icon: ScanSearch,
          searchText: buildSearchText([
            submission.studentName,
            submission.academicId,
            assignment?.title,
            assignment?.subject,
            submission.status,
            submission.analysisStatus,
            riskLevel,
          ]),
        });
      });
    }

    return items;
  }, [
    assignments,
    authMode,
    directoryUsers,
    getAssignmentById,
    getStudentAssignments,
    getStudentSubmissions,
    getTeacherAssignments,
    getTeacherSubmissions,
    submissions,
    unreadCount,
    user,
  ]);

  const filteredSearchItems = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return searchItems.slice(0, 10);
    }

    return searchItems
      .filter((item) => item.searchText.includes(normalizedQuery))
      .slice(0, 12);
  }, [deferredSearchQuery, searchItems]);

  const recentSearchItems = useMemo(
    () =>
      recentSearchIds
        .map((id) => searchItems.find((item) => item.id === id))
        .filter((item): item is SearchItem => Boolean(item))
        .slice(0, 4),
    [recentSearchIds, searchItems],
  );

  const displaySearchItems = useMemo(() => {
    if (deferredSearchQuery.trim()) {
      return filteredSearchItems;
    }

    const recentItemIds = new Set(recentSearchItems.map((item) => item.id));
    const suggestedItems = searchItems
      .filter((item) => !recentItemIds.has(item.id))
      .slice(0, Math.max(0, 10 - recentSearchItems.length));

    return [...recentSearchItems, ...suggestedItems];
  }, [deferredSearchQuery, filteredSearchItems, recentSearchItems, searchItems]);

  const suggestedSearchItems = useMemo(() => {
    if (deferredSearchQuery.trim()) {
      return [];
    }

    return displaySearchItems.slice(recentSearchItems.length);
  }, [deferredSearchQuery, displaySearchItems, recentSearchItems.length]);

  useEffect(() => {
    setHighlightedIndex(displaySearchItems.length > 0 ? 0 : -1);
  }, [deferredSearchQuery, displaySearchItems.length, searchOpen]);

  const recordRecentSearch = useCallback((itemId: string) => {
    setRecentSearchIds((current) => [itemId, ...current.filter((id) => id !== itemId)].slice(0, 6));
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearchIds([]);
  }, []);

  const navigateToSearchItem = useCallback((item: SearchItem) => {
    recordRecentSearch(item.id);
    navigate(item.href);
    setSearchOpen(false);
    setSearchQuery("");
    setHighlightedIndex(0);
  }, [navigate, recordRecentSearch]);

  const renderSearchItemButton = useCallback((item: SearchItem, index: number) => {
    const isActive = index === highlightedIndex;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => navigateToSearchItem(item)}
        onMouseEnter={() => setHighlightedIndex(index)}
        className={cn(
          "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-right transition-colors",
          isActive ? "bg-muted" : "hover:bg-muted",
        )}
      >
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <item.icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
              {item.kindLabel}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
        </div>
      </button>
    );
  }, [highlightedIndex, navigateToSearchItem]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setUserMenuOpen(false);
        setSearchOpen((current) => !current);
        return;
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setUserMenuOpen(false);
        return;
      }

      if (!searchOpen) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((current) =>
          displaySearchItems.length === 0 ? -1 : (current + 1 + displaySearchItems.length) % displaySearchItems.length,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((current) =>
          displaySearchItems.length === 0 ? -1 : (current - 1 + displaySearchItems.length) % displaySearchItems.length,
        );
        return;
      }

      if (event.key === "Enter" && highlightedIndex >= 0 && displaySearchItems[highlightedIndex]) {
        event.preventDefault();
        navigateToSearchItem(displaySearchItems[highlightedIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [displaySearchItems, highlightedIndex, navigateToSearchItem, searchOpen]);

  if (!user) {
    return null;
  }

  const userDisplayName =
    user.fullName.trim().length > 24 ? `${user.fullName.trim().slice(0, 24)}...` : user.fullName.trim();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-lg lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 transition-colors hover:bg-muted lg:hidden"
          aria-label="فتح القائمة"
        >
          <Menu className="h-5 w-5" />
        </button>

        {showBackButton && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={handleBack}
          >
            <ArrowRight className="h-4 w-4" />
            <span className="hidden sm:inline">رجوع</span>
          </Button>
        )}

        <div className="min-w-0 sm:hidden">
          <p className="truncate text-sm font-semibold text-foreground">{currentPageTitle}</p>
        </div>

        <nav className="hidden items-center gap-1 text-sm sm:flex">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />}
              {crumb.href ? (
                <Link
                  to={crumb.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm" className="hidden rounded-xl md:inline-flex">
          <Link to={quickAction.href}>
            <quickAction.icon className="h-4 w-4" />
            {quickAction.label}
          </Link>
        </Button>

        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 transition-colors hover:bg-muted"
          title={theme === "light" ? "الوضع الداكن" : "الوضع الفاتح"}
        >
          {theme === "light" ? (
            <Moon className="h-4.5 w-4.5 text-muted-foreground" />
          ) : (
            <Sun className="h-4.5 w-4.5 text-muted-foreground" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setUserMenuOpen(false);
            setSearchOpen((current) => !current);
          }}
          className="rounded-lg p-2 transition-colors hover:bg-muted"
          title="بحث سريع"
        >
          <Search className="h-4.5 w-4.5 text-muted-foreground" />
        </button>

        <Link to="/notifications" className="relative rounded-lg p-2 transition-colors hover:bg-muted">
          <Bell className="h-4.5 w-4.5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -left-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {formatCounterLabel(unreadCount)}
            </span>
          )}
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen((current) => !current)}
            className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-muted"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="hidden min-w-0 max-w-[220px] text-right md:block">
              <p className="truncate text-sm font-medium leading-tight" title={user.fullName}>
                {userDisplayName}
              </p>
              <p className="text-xs text-muted-foreground">{user.academicId}</p>
            </div>
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-card p-1 shadow-card-hover">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <User className="h-4 w-4" />
                  الملف الشخصي
                </Link>

                <div className="px-3 py-2">
                  <p className="text-xs text-muted-foreground">{getRoleLabel(user.role)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {authMode === "supabase" ? "Supabase" : "محلي"}
                    </span>
                    {user.mustChangePassword && (
                      <span className="rounded-full bg-warning/10 px-2.5 py-1 text-[11px] font-medium text-warning">
                        تغيير كلمة المرور مطلوب
                      </span>
                    )}
                  </div>
                </div>

                <Link
                  to="/settings"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  الإعدادات
                </Link>
                <hr className="my-1 border-border" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                  onClick={() => {
                    void handleSignOut();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  تسجيل الخروج
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {searchOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/10 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          />
          <div className="fixed right-1/2 top-20 z-50 w-full max-w-2xl translate-x-1/2 rounded-2xl border border-border bg-card p-4 shadow-card-hover">
            <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                ref={searchInputRef}
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="ابحث عن صفحات أو تكليفات أو مواد أو مستخدمين أو قضايا أصالة..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <span className="hidden rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground sm:inline-flex">
                Ctrl + K
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>
                {deferredSearchQuery.trim()
                  ? `تم العثور على ${displaySearchItems.length} نتائج`
                  : recentSearchItems.length > 0
                    ? "آخر ما استخدمته مع اقتراحات سريعة"
                    : "اقتراحات سريعة حسب دورك الحالي"}
              </span>
              <span>استخدم الأسهم و Enter للتنقل</span>
            </div>

            <div className="mt-4 max-h-[420px] overflow-y-auto">
              {displaySearchItems.length > 0 ? (
                deferredSearchQuery.trim() ? (
                  <div className="space-y-2">
                    {displaySearchItems.map((item, index) => renderSearchItemButton(item, index))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentSearchItems.length > 0 && (
                      <section className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <p className="text-xs font-medium text-muted-foreground">آخر ما استخدمته</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto rounded-lg px-2 py-1 text-xs"
                            onClick={clearRecentSearches}
                          >
                            مسح السجل
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {recentSearchItems.map((item, index) => renderSearchItemButton(item, index))}
                        </div>
                      </section>
                    )}

                    {suggestedSearchItems.length > 0 && (
                      <section className="space-y-2">
                        <p className="px-1 text-xs font-medium text-muted-foreground">اقتراحات سريعة</p>
                        <div className="space-y-2">
                          {suggestedSearchItems.map((item, index) =>
                            renderSearchItemButton(item, recentSearchItems.length + index),
                          )}
                        </div>
                      </section>
                    )}
                  </div>
                )
              ) : (
                <EmptyState
                  icon={<Search className="h-6 w-6 text-muted-foreground" />}
                  title="لا توجد نتائج مطابقة"
                  description="جرّب البحث باسم طالب أو تكليف أو مادة أو صفحة ترتبط بدورك الحالي."
                  action={(
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        navigate(getRoleHome(user.role));
                        setSearchOpen(false);
                      }}
                    >
                      العودة إلى لوحة التحكم
                    </Button>
                  )}
                  className="py-12"
                />
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
