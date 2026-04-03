import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Activity, AlertTriangle, FileSearch, Filter, Search, Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildActivityFeed,
  getActivityPriorityClass,
  getActivityPriorityLabel,
  isFailedAnalysisActivity,
  type ActivityCategory,
  type ActivityFeedItem,
} from "@/lib/activity-feed";
import { formatDateTimeLabel } from "@/lib/academic-data";

type ActivityFilter = "all" | ActivityCategory | "attention" | "failed" | "today";

function parseActivityFilter(value: string | null): ActivityFilter {
  if (
    value === "assignment"
    || value === "submission"
    || value === "analysis"
    || value === "review"
    || value === "settings"
    || value === "attention"
    || value === "failed"
    || value === "today"
  ) {
    return value;
  }

  return "all";
}

function buildActivityTarget(item: ActivityFeedItem) {
  if (item.category === "settings") {
    return "/admin/settings";
  }

  if (item.category === "analysis" && isFailedAnalysisActivity(item)) {
    return "/admin/reports?filter=failed";
  }

  if (item.category === "analysis" || item.category === "review" || item.category === "submission") {
    return "/admin/reports";
  }

  if (item.category === "assignment") {
    return "/admin/activity?filter=assignment";
  }

  return null;
}

export default function AdminActivity() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<ActivityFilter>(parseActivityFilter(searchParams.get("filter")));
  const { authMode, directoryUsers } = useAuth();
  const {
    activityFeed: persistedActivityFeed,
    assignments,
    originalityChecks,
    persistenceMode,
    reviews,
    submissions,
  } = useAcademicData();

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setFilter(parseActivityFilter(searchParams.get("filter")));
  }, [searchParams]);

  const updateSearchState = (nextFilter: ActivityFilter, nextQuery: string) => {
    const params = new URLSearchParams(searchParams);

    if (nextFilter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", nextFilter);
    }

    const normalizedQuery = nextQuery.trim();
    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    } else {
      params.delete("q");
    }

    setSearchParams(params, { replace: true });
  };

  const derivedActivityFeed = useMemo(
    () =>
      buildActivityFeed({
        assignments,
        originalityChecks,
        reviews,
        submissions,
        users: directoryUsers,
      }),
    [assignments, directoryUsers, originalityChecks, reviews, submissions],
  );

  const activityFeed = useMemo(() => {
    if (persistenceMode === "supabase" && persistedActivityFeed.length > 0) {
      return persistedActivityFeed;
    }

    if (persistedActivityFeed.length === 0) {
      return derivedActivityFeed;
    }

    const derivedIds = new Set(derivedActivityFeed.map((item) => item.id));
    return [...persistedActivityFeed.filter((item) => !derivedIds.has(item.id)), ...derivedActivityFeed]
      .sort((left, right) => +new Date(right.occurredAt) - +new Date(left.occurredAt));
  }, [derivedActivityFeed, persistedActivityFeed, persistenceMode]);

  const isUsingPersistedFeed = persistenceMode === "supabase" && persistedActivityFeed.length > 0;

  const filteredActivity = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const todayKey = new Date().toISOString().slice(0, 10);

    return activityFeed.filter((item) => {
      if (filter === "today" && item.occurredAt.slice(0, 10) !== todayKey) {
        return false;
      }

      if (filter === "attention" && item.priority === "normal") {
        return false;
      }

      if (filter === "failed" && !isFailedAnalysisActivity(item)) {
        return false;
      }

      if (
        filter !== "all"
        && filter !== "attention"
        && filter !== "failed"
        && filter !== "today"
        && item.category !== filter
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        item.actorName,
        item.actorRoleLabel,
        item.action,
        item.details,
        item.categoryLabel,
        item.statusLabel,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activityFeed, filter, query]);

  const metrics = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const actors = new Set(activityFeed.map((item) => `${item.actorRole}:${item.actorName}`));

    return {
      total: activityFeed.length,
      today: activityFeed.filter((item) => item.occurredAt.slice(0, 10) === todayKey).length,
      attention: activityFeed.filter((item) => item.priority !== "normal").length,
      analyses: activityFeed.filter((item) => item.category === "analysis").length,
      failed: activityFeed.filter((item) => isFailedAnalysisActivity(item)).length,
      actors: actors.size,
    };
  }, [activityFeed]);

  const handleFilterChange = (nextFilter: ActivityFilter) => {
    setFilter(nextFilter);
    updateSearchState(nextFilter, query);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    updateSearchState(filter, value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-h1 font-bold">سجل النشاطات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isUsingPersistedFeed
              ? "السجل الحالي محمل من activity_logs في Supabase ويعرض الأحداث المحفوظة بشكل دائم."
              : "السجل الحالي مشتق من العمليات الفعلية داخل التكليفات والتسليمات والتحليلات والمراجعات، وسيُستخدم activity_logs تلقائيًا عند توفره."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            وضع المصادقة: {authMode === "supabase" ? "Supabase" : "محلي تجريبي"} | مصدر البيانات
            الأكاديمية: {persistenceMode === "supabase" ? "Supabase" : "محلي تجريبي"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard title="إجمالي النشاطات" value={metrics.total} icon={Activity} onClick={() => handleFilterChange("all")} active={filter === "all"} />
        <StatCard title="نشاطات اليوم" value={metrics.today} icon={FileSearch} onClick={() => handleFilterChange("today")} active={filter === "today"} />
        <StatCard title="يتطلب متابعة" value={metrics.attention} icon={AlertTriangle} onClick={() => handleFilterChange("attention")} active={filter === "attention"} />
        <StatCard title="تحليلات الأصالة" value={metrics.analyses} icon={Filter} onClick={() => handleFilterChange("analysis")} active={filter === "analysis"} />
        <StatCard title="فشل التحليل" value={metrics.failed} icon={AlertTriangle} onClick={() => handleFilterChange("failed")} active={filter === "failed"} />
        <StatCard title="أطراف نشطة" value={metrics.actors} icon={Users} />
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ابحث بالمستخدم أو الإجراء أو حالة النشاط..."
              className="h-10 rounded-xl pr-9"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "الكل" },
              { key: "today", label: "اليوم" },
              { key: "assignment", label: "تكليفات" },
              { key: "submission", label: "تسليمات" },
              { key: "analysis", label: "تحليلات" },
              { key: "failed", label: "فشل التحليل" },
              { key: "settings", label: "إعدادات" },
              { key: "review", label: "مراجعات" },
              { key: "attention", label: "يتطلب متابعة" },
            ].map((item) => (
              <Button
                key={item.key}
                type="button"
                variant={filter === item.key ? "default" : "outline"}
                className="h-9 rounded-xl text-xs"
                onClick={() => handleFilterChange(item.key as ActivityFilter)}
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
                <th className="p-3 px-5 text-right font-medium text-muted-foreground">المستخدم</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الإجراء</th>
                <th className="hidden p-3 text-right font-medium text-muted-foreground lg:table-cell">
                  التفاصيل
                </th>
                <th className="p-3 text-right font-medium text-muted-foreground">التصنيف</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الحالة</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الأولوية</th>
                <th className="p-3 text-right font-medium text-muted-foreground">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivity.map((item) => {
                const target = buildActivityTarget(item);

                return (
                  <tr
                    key={item.id}
                    className={[
                      "border-b border-border transition-colors last:border-0 hover:bg-muted/50",
                      target ? "cursor-pointer" : "",
                    ].join(" ")}
                    onClick={() => {
                      if (target) {
                        navigate(target);
                      }
                    }}
                  >
                    <td className="p-3 px-5">
                      <div>
                        <p className="font-medium">{item.actorName}</p>
                        <p className="text-xs text-muted-foreground">{item.actorRoleLabel}</p>
                      </div>
                    </td>
                    <td className="p-3">
                      <div>
                        <p className="font-medium">{item.action}</p>
                        <p className="text-xs text-muted-foreground lg:hidden">{item.details}</p>
                      </div>
                    </td>
                    <td className="hidden p-3 text-muted-foreground lg:table-cell">{item.details}</td>
                    <td className="p-3 text-muted-foreground">{item.categoryLabel}</td>
                    <td className="p-3">
                      <StatusBadge variant={item.statusVariant} label={item.statusLabel} />
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getActivityPriorityClass(item.priority)}`}
                      >
                        {getActivityPriorityLabel(item.priority)}
                      </span>
                    </td>
                    <td className="p-3 text-xs tabular-nums text-muted-foreground">
                      {formatDateTimeLabel(item.occurredAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredActivity.length === 0 && (
          <EmptyState
            icon={<Activity className="h-6 w-6 text-muted-foreground" />}
            title="لا توجد نشاطات مطابقة"
            description="جرّب تغيير البحث أو الفلتر لعرض نشاطات النظام الحالية."
            className="px-6"
          />
        )}
      </div>
    </div>
  );
}
