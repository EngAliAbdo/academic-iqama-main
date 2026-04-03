import { useEffect, useMemo, useState } from "react";
import { Clock3, RotateCcw, Save, Settings2, ShieldCheck, Upload } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { toast } from "@/hooks/use-toast";
import { formatDateTimeLabel } from "@/lib/academic-data";
import {
  DEFAULT_SYSTEM_SETTINGS,
  SUPPORTED_SUBMISSION_FORMATS,
  type SystemSettings,
} from "@/lib/system-settings";
import { useSystemSettings } from "@/hooks/use-system-settings";

export default function AdminSettings() {
  const { settings, storageMode, isSyncing, updateSettings } = useSystemSettings();
  const { activityFeed } = useAcademicData();
  const [form, setForm] = useState<SystemSettings>(settings);
  const [saving, setSaving] = useState(false);

  const settingsActivity = useMemo(
    () => activityFeed.filter((item) => item.category === "settings").slice(0, 4),
    [activityFeed],
  );

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const toggleFormat = (format: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      allowedSubmissionFormats: checked
        ? Array.from(new Set([...current.allowedSubmissionFormats, format]))
        : current.allowedSubmissionFormats.filter((item) => item !== format),
    }));
  };

  const handleSave = async () => {
    if (!form.institutionName.trim() || !form.academicYear.trim()) {
      toast({
        title: "البيانات ناقصة",
        description: "أدخل اسم المؤسسة والعام الأكاديمي قبل الحفظ.",
        variant: "destructive",
      });
      return;
    }

    if (form.allowedSubmissionFormats.length === 0) {
      toast({
        title: "صيغ التسليم مطلوبة",
        description: "اختر صيغة واحدة على الأقل لرفع تسليمات الطلاب.",
        variant: "destructive",
      });
      return;
    }

    if (Number(form.maxUploadSizeMb) < 1 || Number(form.maxUploadSizeMb) > 100) {
      toast({
        title: "حجم الرفع غير صالح",
        description: "الحد الأقصى لحجم الملف يجب أن يكون بين 1 و100 ميجابايت.",
        variant: "destructive",
      });
      return;
    }

    if (Number(form.highRiskBelow) >= Number(form.mediumRiskBelow)) {
      toast({
        title: "حدود الخطورة غير منطقية",
        description: "يجب أن يكون حد الخطورة المرتفعة أقل من حد الخطورة المتوسطة.",
        variant: "destructive",
      });
      return;
    }

    if (
      Number(form.suspiciousAlertBelow) < Number(form.highRiskBelow)
      || Number(form.suspiciousAlertBelow) > Number(form.mediumRiskBelow)
    ) {
      toast({
        title: "حد التنبيه غير صالح",
        description: "حد التنبيه يجب أن يكون بين حد الخطورة المرتفعة والمتوسطة.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const saved = await updateSettings(form);
      setForm(saved);

      toast({
        title: "تم حفظ الإعدادات",
        description:
          storageMode === "supabase"
            ? "تم تحديث الإعدادات في Supabase ومزامنتها مع النسخة الحالية."
            : "تم تحديث الإعدادات محليًا حتى تكتمل بيئة Supabase.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);

    try {
      const restored = await updateSettings(DEFAULT_SYSTEM_SETTINGS);
      setForm(restored);

      toast({
        title: "تمت استعادة الإعدادات الافتراضية",
        description: "عاد النظام إلى إعداداته الأساسية المعتمدة.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-h1 font-bold">إعدادات النظام</h1>
          <p className="text-sm text-muted-foreground">
            إعدادات الرفع والأصالة والتحليل الظاهرة مباشرة في تشغيل المنصة.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {storageMode === "supabase" ? "التخزين الحالي Supabase" : "التخزين الحالي محلي"}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {form.autoStartAnalysis ? "التحليل تلقائي" : "التحليل يدوي"}
          </Badge>
          {isSyncing && (
            <Badge variant="outline" className="rounded-full px-3 py-1">
              جارٍ مزامنة الإعدادات
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl bg-card p-6 shadow-card">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">معلومات المؤسسة</h2>
              <p className="text-sm text-muted-foreground">
                البيانات المرجعية الظاهرة داخل الواجهة ولوحات المتابعة.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="institution-name">اسم المؤسسة</Label>
            <Input
              id="institution-name"
              className="h-11 rounded-xl"
              value={form.institutionName}
              onChange={(event) =>
                setForm((current) => ({ ...current, institutionName: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="academic-year">العام الأكاديمي</Label>
            <Input
              id="academic-year"
              className="h-11 rounded-xl"
              value={form.academicYear}
              onChange={(event) =>
                setForm((current) => ({ ...current, academicYear: event.target.value }))
              }
            />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-card p-6 shadow-card">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-info/10 p-3 text-info">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">سياسة الرفع</h2>
              <p className="text-sm text-muted-foreground">
                القواعد التي تحكم ملفات التسليم المرفوعة من الطلاب.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-upload-size">الحد الأقصى لحجم الملف (MB)</Label>
            <Input
              id="max-upload-size"
              type="number"
              min={1}
              max={100}
              className="h-11 rounded-xl"
              value={form.maxUploadSizeMb}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  maxUploadSizeMb: Number(event.target.value || DEFAULT_SYSTEM_SETTINGS.maxUploadSizeMb),
                }))
              }
            />
          </div>

          <div className="space-y-3">
            <Label>الصيغ المدعومة</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {SUPPORTED_SUBMISSION_FORMATS.map((format) => {
                const checked = form.allowedSubmissionFormats.includes(format);

                return (
                  <label
                    key={format}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-4 py-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{format}</p>
                      <p className="text-xs text-muted-foreground">
                        {format === "PDF"
                          ? "أنسب للتقارير والملفات النهائية"
                          : "أنسب للمستندات القابلة للتحرير"}
                      </p>
                    </div>
                    <Switch
                      checked={checked}
                      onCheckedChange={(nextChecked) => toggleFormat(format, nextChecked)}
                      aria-label={`تفعيل صيغة ${format}`}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl bg-card p-6 shadow-card">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">إعدادات التشغيل والتحليل</h2>
              <p className="text-sm text-muted-foreground">
                تتحكم في توقيت بدء التحليل وكيفية التعامل مع حالات تعذر استخراج النص.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs text-muted-foreground">وضع التحليل الحالي</p>
              <p className="mt-2 text-sm font-semibold">
                {form.autoStartAnalysis ? "تلقائي بعد الرفع" : "يدوي من المعلم"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs text-muted-foreground">عند فشل استخراج النص</p>
              <p className="mt-2 text-sm font-semibold">
                {form.manualReviewOnExtractionFailure ? "تحويل إلى مراجعة يدوية" : "فشل التحليل مباشرة"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">بدء التحليل تلقائيًا بعد الرفع</p>
                <p className="text-xs text-muted-foreground">
                  عند تفعيله يبدأ تدفق الأصالة مباشرة بعد إنشاء التسليم.
                </p>
              </div>
              <Switch
                checked={form.autoStartAnalysis}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, autoStartAnalysis: checked }))
                }
                aria-label="بدء التحليل تلقائيًا"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">تحويل فشل استخراج النص إلى مراجعة يدوية</p>
                <p className="text-xs text-muted-foreground">
                  إذا تم تعطيله سيتحول التعذر إلى فشل تحليل بدلًا من مراجعة يدوية.
                </p>
              </div>
              <Switch
                checked={form.manualReviewOnExtractionFailure}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    manualReviewOnExtractionFailure: checked,
                  }))
                }
                aria-label="مراجعة يدوية عند تعذر استخراج النص"
              />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-card p-6 shadow-card">
          <div>
            <h2 className="font-semibold">سياسة الأصالة والاشتباه</h2>
            <p className="text-sm text-muted-foreground">
              كلما انخفضت الأصالة عن هذه الحدود، ينتقل التسليم إلى مستوى خطورة أعلى.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="medium-risk-below">حد الخطورة المتوسطة (%)</Label>
              <Input
                id="medium-risk-below"
                type="number"
                min={1}
                max={100}
                className="h-11 rounded-xl"
                value={form.mediumRiskBelow}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    mediumRiskBelow: Number(
                      event.target.value || DEFAULT_SYSTEM_SETTINGS.mediumRiskBelow,
                    ),
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="high-risk-below">حد الخطورة المرتفعة (%)</Label>
              <Input
                id="high-risk-below"
                type="number"
                min={1}
                max={99}
                className="h-11 rounded-xl"
                value={form.highRiskBelow}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    highRiskBelow: Number(
                      event.target.value || DEFAULT_SYSTEM_SETTINGS.highRiskBelow,
                    ),
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="suspicious-alert-below">حد إظهار القضية في التنبيهات والتقارير (%)</Label>
            <Input
              id="suspicious-alert-below"
              type="number"
              min={1}
              max={100}
              className="h-11 rounded-xl"
              value={form.suspiciousAlertBelow}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  suspiciousAlertBelow: Number(
                    event.target.value || DEFAULT_SYSTEM_SETTINGS.suspiciousAlertBelow,
                  ),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              أي تسليم تقل أصالته عن هذا الحد سيظهر ضمن الحالات التي تتطلب متابعة حتى لو لم يصل
              إلى الخطورة المرتفعة.
            </p>
          </div>
        </section>
      </div>

      <section className="space-y-4 rounded-2xl bg-card p-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-info/10 p-3 text-info">
            <Clock3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">آخر تغييرات الإعدادات</h2>
            <p className="text-sm text-muted-foreground">
              سجل مختصر لآخر العمليات المسجلة على سياسة النظام الحالية.
            </p>
          </div>
        </div>

        {settingsActivity.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {settingsActivity.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-border/70 bg-background/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.details}</p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
                    {item.statusLabel}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{item.actorName}</span>
                  <span className="tabular-nums">{formatDateTimeLabel(item.occurredAt)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Clock3 className="h-6 w-6 text-muted-foreground" />}
            title="لا توجد تغييرات مسجلة بعد"
            description="عند حفظ أي تعديل في سياسة النظام سيظهر مباشرة هنا."
            className="py-8"
          />
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="gap-2 rounded-xl"
          onClick={() => {
            void handleReset();
          }}
          disabled={saving || isSyncing}
        >
          <RotateCcw className="h-4 w-4" />
          استعادة الافتراضي
        </Button>
        <Button
          type="button"
          className="gap-2 rounded-xl shadow-button"
          onClick={() => {
            void handleSave();
          }}
          disabled={saving || isSyncing}
        >
          <Save className="h-4 w-4" />
          {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>
    </div>
  );
}
