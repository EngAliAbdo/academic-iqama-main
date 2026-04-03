import { useState } from "react";
import { Bell, Check, CheckCheck, Clock, GraduationCap, MessageSquare, Send, Settings2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationsContext } from "@/contexts/NotificationsContext";
import { NOTIFICATION_TYPE_LABELS, type NotificationType } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  grade: GraduationCap,
  deadline: Clock,
  feedback: MessageSquare,
  submission: Send,
  system: Settings2,
};

const TYPE_ICON_COLORS: Record<NotificationType, string> = {
  grade: "bg-green-500/10 text-green-600 dark:text-green-400",
  deadline: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  feedback: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  submission: "bg-primary/10 text-primary",
  system: "bg-muted text-muted-foreground",
};

type FilterType = NotificationType | "all";

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "grade", label: "الدرجات" },
  { key: "deadline", label: "المواعيد" },
  { key: "feedback", label: "الملاحظات" },
  { key: "submission", label: "التسليمات" },
  { key: "system", label: "النظام" },
];

export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, getByType } = useNotificationsContext();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const filtered = getByType(activeFilter);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 font-bold">الإشعارات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} إشعارات غير مقروءة` : "لا توجد إشعارات جديدة"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={markAllAsRead}>
            <CheckCheck className="h-3.5 w-3.5" />
            تحديد الكل كمقروء
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTER_TABS.map((tab) => {
          const count = tab.key === "all" ? notifications.length : getByType(tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
              <span className={`text-xs tabular-nums ${activeFilter === tab.key ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notifications list */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-card p-12 text-center">
          <Filter className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">لا توجد إشعارات في هذا التصنيف</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-card divide-y divide-border overflow-hidden">
          {filtered.map((n) => {
            const Icon = TYPE_ICONS[n.type];
            const iconColor = TYPE_ICON_COLORS[n.type];
            const timeAgo = formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ar });

            return (
              <div
                key={n.id}
                className={`p-4 flex gap-3 cursor-pointer transition-colors hover:bg-muted/50 ${!n.read ? "bg-primary/5" : ""}`}
                onClick={() => markAsRead(n.id)}
              >
                <div className={`mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                    {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-muted-foreground/70">{timeAgo}</span>
                    <span className="text-[11px] text-muted-foreground/50">•</span>
                    <span className="text-[11px] text-muted-foreground/70">{NOTIFICATION_TYPE_LABELS[n.type]}</span>
                  </div>
                </div>
                {!n.read && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                    className="p-1.5 rounded-lg hover:bg-muted self-center shrink-0"
                    title="تحديد كمقروء"
                  >
                    <Check className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
