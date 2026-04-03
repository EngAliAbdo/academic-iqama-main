import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured, resolveSupabaseLoginIdentifier } from "@/lib/supabase-app";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    tone: "success" | "error" | null;
    message: string;
  }>({ tone: null, message: "" });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setResult({ tone: null, message: "" });

    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier) {
      setResult({
        tone: "error",
        message: "أدخل الرقم الأكاديمي أو رقم الموظف أو البريد الإلكتروني أولًا.",
      });
      return;
    }

    if (!isSupabaseConfigured()) {
      setResult({
        tone: "error",
        message: "استعادة كلمة المرور غير متاحة في الوضع المحلي. فعّل Supabase أولًا.",
      });
      return;
    }

    setSubmitting(true);

    try {
      const email = await resolveSupabaseLoginIdentifier(normalizedIdentifier);

      if (!email) {
        setResult({
          tone: "success",
          message: "إذا كانت البيانات صحيحة فسيتم إرسال رابط إعادة التعيين إلى البريد المسجل.",
        });
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/change-password`,
      });

      if (error) {
        setResult({
          tone: "error",
          message: "تعذر إرسال رابط الاستعادة الآن. حاول مرة أخرى بعد قليل.",
        });
        setSubmitting(false);
        return;
      }

      setResult({
        tone: "success",
        message: "تم إرسال رابط الاستعادة. افتح بريدك ثم تابع تغيير كلمة المرور من الرابط.",
      });
      setSubmitting(false);
    } catch {
      setResult({
        tone: "error",
        message: "حدث خطأ غير متوقع أثناء طلب الاستعادة.",
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="rounded-2xl bg-primary p-3 mb-4">
              <GraduationCap className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-h2 font-bold">استعادة كلمة المرور</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              أدخل الرقم الأكاديمي أو رقم الموظف أو البريد الإلكتروني، وسنرسل رابط إعادة التعيين إلى البريد المسجل.
            </p>
          </div>

          <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="identifier">المعرف الجامعي أو الوظيفي أو البريد</Label>
              <Input
                id="identifier"
                placeholder="مثال: 202312345 أو 9001001 أو user@university.edu"
                className="rounded-xl h-11"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </div>

            {result.tone && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  result.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-destructive/20 bg-destructive/5 text-destructive"
                }`}
              >
                <div className="flex items-start gap-2">
                  {result.tone === "success" && <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />}
                  <p>{result.message}</p>
                </div>
              </div>
            )}

            <Button className="w-full rounded-xl h-11 shadow-button" disabled={submitting}>
              {submitting ? "جارٍ إرسال الرابط..." : "إرسال رابط الاستعادة"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            <Link to="/login" className="text-primary hover:underline inline-flex items-center gap-1">
              <ArrowRight className="h-3.5 w-3.5" />
              العودة لتسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
