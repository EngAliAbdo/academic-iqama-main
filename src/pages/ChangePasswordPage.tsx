import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Eye, EyeOff, Moon, ShieldCheck, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleHome } from "@/lib/auth";

const PASSWORD_RULES = [
  { id: "length", label: "8 أحرف على الأقل", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "حرف كبير واحد على الأقل", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "حرف صغير واحد على الأقل", test: (p: string) => /[a-z]/.test(p) },
  { id: "number", label: "رقم واحد على الأقل", test: (p: string) => /\d/.test(p) },
  { id: "special", label: "رمز خاص واحد على الأقل (!@#$...)", test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
];

function getStrength(password: string) {
  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  return Math.round((passed / PASSWORD_RULES.length) * 100);
}

function getStrengthMeta(strength: number) {
  if (strength <= 20) return { label: "ضعيفة جداً", color: "bg-destructive" };
  if (strength <= 40) return { label: "ضعيفة", color: "bg-orange-500" };
  if (strength <= 60) return { label: "متوسطة", color: "bg-yellow-500" };
  if (strength <= 80) return { label: "جيدة", color: "bg-emerald-400" };
  return { label: "قوية", color: "bg-emerald-600" };
}

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, changePassword } = useAuth();

  const strength = useMemo(() => getStrength(newPassword), [newPassword]);
  const meta = useMemo(() => getStrengthMeta(strength), [strength]);
  const allPassed = strength === 100;
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const canSubmit = allPassed && passwordsMatch && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    const result = await changePassword(newPassword);
    if (!result.ok) {
      setSubmitting(false);
      toast({
        title: "تعذر تحديث كلمة المرور",
        description: result.error ?? "حدث خطأ غير متوقع.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "تم تغيير كلمة المرور بنجاح",
      description: "يمكنك الآن متابعة استخدام النظام بكلمة المرور الجديدة.",
    });
    setSubmitting(false);
    navigate(user ? getRoleHome(user.role) : "/login");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <button
        onClick={toggleTheme}
        className="absolute top-4 left-4 p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground shadow-sm transition-colors"
        aria-label="تبديل الوضع"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="rounded-2xl bg-primary p-3 mb-4">
              <ShieldCheck className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">تغيير كلمة المرور</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              يجب تغيير كلمة المرور عند أول تسجيل دخول لضمان أمان حسابك
            </p>
            {user && (
              <p className="text-xs text-muted-foreground mt-3">
                {user.fullName} - {user.academicId}
              </p>
            )}
          </div>

          <form className="space-y-5" onSubmit={(e) => { void handleSubmit(e); }}>
            <div className="space-y-2">
              <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  placeholder="أدخل كلمة المرور الجديدة"
                  className="rounded-xl h-11 pl-10"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {newPassword.length > 0 && (
                <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">قوة كلمة المرور</span>
                    <span className={`font-medium ${strength >= 80 ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ease-out ${meta.color}`} style={{ width: `${strength}%` }} />
                  </div>

                  <ul className="space-y-1 pt-1">
                    {PASSWORD_RULES.map((rule) => {
                      const passed = rule.test(newPassword);
                      return (
                        <li key={rule.id} className="flex items-center gap-2 text-xs">
                          {passed ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                          )}
                          <span className={passed ? "text-foreground" : "text-muted-foreground"}>{rule.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  placeholder="أعد إدخال كلمة المرور"
                  className="rounded-xl h-11 pl-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive animate-in fade-in duration-200">كلمتا المرور غير متطابقتين</p>
              )}
              {passwordsMatch && (
                <p className="text-xs text-emerald-600 flex items-center gap-1 animate-in fade-in duration-200">
                  <Check className="h-3.5 w-3.5" /> كلمتا المرور متطابقتان
                </p>
              )}
            </div>

            <Button type="submit" className="w-full rounded-xl h-11 shadow-button mt-2" disabled={!canSubmit}>
              {submitting ? "جارٍ الحفظ..." : "حفظ كلمة المرور الجديدة"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
