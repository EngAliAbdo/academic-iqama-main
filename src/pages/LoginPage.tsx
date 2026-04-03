import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, GraduationCap, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleHome, getRoleLabel } from "@/lib/auth";
import { isLocalDemoFallbackEnabled, isSupabaseConfigured } from "@/lib/supabase-app";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { demoAccounts, signIn } = useAuth();
  const supabaseConfigured = isSupabaseConfigured();
  const localDemoFallbackEnabled = isLocalDemoFallbackEnabled();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const result = await signIn({ identifier, password });
    if (!result.ok || !result.user) {
      setSubmitting(false);
      setError(result.error ?? "تعذر تسجيل الدخول.");
      return;
    }

    if (result.requiresPasswordChange) {
      setSubmitting(false);
      navigate("/change-password");
      return;
    }

    const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    setSubmitting(false);
    navigate(redirectTo ?? getRoleHome(result.user.role));
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <button
        onClick={toggleTheme}
        className="absolute left-4 top-4 rounded-xl border border-border bg-card p-2.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        aria-label="تبديل الوضع"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-card p-8 shadow-card">
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 rounded-2xl bg-primary p-3">
              <GraduationCap className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-h2 font-bold">تسجيل الدخول إلى النظام</h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              استخدم الرقم الأكاديمي للطالب أو رقم الموظف للمعلم والإدارة.
            </p>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {!supabaseConfigured
                ? "المشروع يعمل حاليًا بوضع محلي تجريبي إلى حين ربط Supabase الحقيقي."
                : localDemoFallbackEnabled
                  ? "المصادقة الفعلية عبر Supabase مفعلة مع بقاء الحسابات التجريبية كخيار احتياطي."
                  : "المصادقة الحية عبر Supabase مفعلة، وتم إيقاف الرجوع المحلي الصامت."}
            </p>
          </div>

          <form className="space-y-5" onSubmit={(event) => void handleLogin(event)}>
            <div className="space-y-2">
              <Label htmlFor="identifier">الرقم الأكاديمي أو رقم الموظف</Label>
              <Input
                id="identifier"
                placeholder="مثال: 202312345 أو 9001001"
                className="h-11 rounded-xl"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">كلمة المرور</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  نسيت كلمة المرور؟
                </Link>
              </div>

              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-11 rounded-xl pl-10"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="mt-2 h-11 w-full rounded-xl shadow-button" disabled={submitting}>
              {submitting ? "جارٍ التحقق..." : "تسجيل الدخول"}
            </Button>
          </form>

          {(localDemoFallbackEnabled || !supabaseConfigured) && (
            <div className="mt-6 border-t border-border pt-6">
              <p className="mb-3 text-center text-xs text-muted-foreground">
                حسابات تجريبية جاهزة للدخول:
              </p>
              <div className="space-y-2">
                {demoAccounts.map((account) => (
                  <button
                    key={account.academicId}
                    type="button"
                    onClick={() => {
                      setIdentifier(account.academicId);
                      setPassword(account.password);
                      setError("");
                    }}
                    className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-right transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{account.fullName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {getRoleLabel(account.role)} - {account.academicId}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-muted-foreground">كلمة المرور</p>
                        <p className="text-xs font-semibold">{account.password}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">
            العودة للصفحة الرئيسية
          </Link>
        </p>
      </div>
    </div>
  );
}
