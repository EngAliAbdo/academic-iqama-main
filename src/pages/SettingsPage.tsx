import { useEffect, useState } from "react";
import { Bell, Moon, ShieldCheck, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleLabel } from "@/lib/auth";
import {
  DEFAULT_PREFERENCES,
  loadUserPreferences,
  saveUserPreferences,
  type UserPreferences,
} from "@/lib/user-preferences";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    setPreferences(loadUserPreferences(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      return;
    }

    saveUserPreferences(preferences, user.id);
  }, [preferences, user]);

  const togglePreference = (key: keyof UserPreferences, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold">الإعدادات</h1>
        <p className="text-sm text-muted-foreground mt-1">
          إدارة تفضيلات الواجهة والتنبيهات وأمان الحساب.
        </p>
      </div>

      <section className="bg-card rounded-2xl shadow-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          {theme === "dark" ? (
            <Moon className="h-5 w-5 text-primary" />
          ) : (
            <Sun className="h-5 w-5 text-primary" />
          )}
          <div>
            <h2 className="font-semibold">وضع العرض</h2>
            <p className="text-sm text-muted-foreground">
              التبديل بين الوضع الفاتح والداكن.
            </p>
          </div>
          <Button variant="outline" className="mr-auto rounded-xl" onClick={toggleTheme}>
            {theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
          </Button>
        </div>
      </section>

      <section className="bg-card rounded-2xl shadow-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">التنبيهات</h2>
            <p className="text-sm text-muted-foreground">
              تحكم في أنواع التنبيهات التي تظهر لك داخل النظام.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            {
              key: "emailNotifications" as const,
              title: "تنبيهات البريد الإلكتروني",
              description: "إرسال البريد نفسه سيتوفر بعد ربط خدمة بريد فعلية.",
              pending: true,
            },
            {
              key: "deadlineAlerts" as const,
              title: "تنبيهات المواعيد النهائية",
              description: "تذكير قبل مواعيد التسليم القريبة.",
              pending: false,
            },
            {
              key: "weeklySummary" as const,
              title: "ملخص أسبوعي",
              description: "ملخص أسبوعي للمهام والدرجات والنشاطات الجديدة.",
              pending: false,
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4 rounded-xl bg-muted p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{item.title}</p>
                  {item.pending && (
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      قريبًا
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={preferences[item.key]}
                disabled={item.pending}
                onCheckedChange={(checked) => togglePreference(item.key, checked)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card rounded-2xl shadow-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">أمان الحساب</h2>
            <p className="text-sm text-muted-foreground">
              مراجعة معلومات الجلسة والإجراءات الأمنية الأساسية.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl bg-muted p-4">
            <p className="text-xs text-muted-foreground">المستخدم الحالي</p>
            <p className="font-medium mt-1">{user.fullName}</p>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <p className="text-xs text-muted-foreground">الدور</p>
            <p className="font-medium mt-1">{getRoleLabel(user.role)}</p>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <p className="text-xs text-muted-foreground">الرقم الأكاديمي</p>
            <p className="font-medium mt-1">{user.academicId}</p>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <p className="text-xs text-muted-foreground">القسم</p>
            <p className="font-medium mt-1">{user.department}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link to="/change-password">
            <Button className="rounded-xl shadow-button">تغيير كلمة المرور</Button>
          </Link>
          <Link to="/profile">
            <Button variant="outline" className="rounded-xl">
              العودة إلى الملف الشخصي
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
