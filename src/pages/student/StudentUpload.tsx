import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { toast } from "@/hooks/use-toast";
import { formatDateLabel } from "@/lib/academic-data";
import {
  getEffectiveAllowedFormats,
  getMaxUploadSizeBytes,
} from "@/lib/system-settings";
import {
  createAssignmentAttachmentSignedUrl,
  formatFileSize,
  isSupabaseConfigured,
  uploadSupabaseSubmissionFile,
} from "@/lib/supabase-app";
import { cn } from "@/lib/utils";

const FILE_EXTENSION_TO_ACCEPT: Record<string, string> = {
  PDF: ".pdf",
  DOCX: ".docx",
  PPTX: ".pptx",
};

function shortenAssignmentText(value: string, maxLength = 30) {
  const normalized = value.trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

export default function StudentUpload() {
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { user, authMode } = useAuth();
  const { settings } = useSystemSettings();
  const { getStudentAssignments, getStudentSubmission, submitAssignment } =
    useAcademicData();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const assignmentId = searchParams.get("assignment");
  const studentAssignments = useMemo(() => {
    if (!user) {
      return [];
    }

    return getStudentAssignments(user.id);
  }, [getStudentAssignments, user]);
  const assignment = useMemo(() => {
    if (!user) {
      return undefined;
    }

    if (assignmentId) {
      return studentAssignments.find((item) => item.id === assignmentId);
    }

    return studentAssignments.find((item) => !getStudentSubmission(user.id, item.id))
      ?? studentAssignments[0];
  }, [assignmentId, getStudentSubmission, studentAssignments, user]);

  useEffect(() => {
    if (!assignment) {
      return;
    }

    if (assignmentId === assignment.id) {
      return;
    }

    setSearchParams({ assignment: assignment.id }, { replace: true });
  }, [assignment, assignmentId, setSearchParams]);

  const effectiveAllowedFormats = useMemo(
    () => getEffectiveAllowedFormats(assignment?.allowedFormats, settings),
    [assignment?.allowedFormats, settings],
  );
  const maxFileSizeBytes = useMemo(() => getMaxUploadSizeBytes(settings), [settings]);
  const acceptedExtensions = useMemo(
    () =>
      effectiveAllowedFormats
        .map((format) => FILE_EXTENSION_TO_ACCEPT[format.toUpperCase()])
        .filter(Boolean)
        .join(","),
    [effectiveAllowedFormats],
  );
  const hasCompatibleFormats = effectiveAllowedFormats.length > 0;

  if (!user) {
    return null;
  }

  if (studentAssignments.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
        <h1 className="text-h1 font-bold">لا توجد تكليفات متاحة للرفع</h1>
        <p className="text-muted-foreground">
          لا توجد حالياً تكليفات منشورة ومربوطة بموادك حتى تتمكن من الرفع.
        </p>
        <Link to="/student/assignments">
          <Button className="rounded-xl">العودة إلى التكليفات</Button>
        </Link>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
        <h1 className="text-h1 font-bold">التكليف المحدد غير متاح</h1>
        <p className="text-muted-foreground">
          اختر تكليفاً صحيحاً من صفحة التكليفات ثم عد إلى صفحة الرفع.
        </p>
        <Link to="/student/assignments">
          <Button className="rounded-xl">العودة إلى التكليفات</Button>
        </Link>
      </div>
    );
  }

  const existingSubmission = getStudentSubmission(user.id, assignment.id);
  const hasDownloadableAttachments =
    authMode === "supabase" && isSupabaseConfigured() && assignment.attachments.length > 0;

  const resetSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validateFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toUpperCase() ?? "";

    if (!hasCompatibleFormats) {
      toast({
        title: "التكليف غير جاهز للرفع",
        description: "لا توجد صيغ متوافقة بين سياسة المؤسسة وإعدادات هذا التكليف.",
        variant: "destructive",
      });
      return false;
    }

    if (!effectiveAllowedFormats.includes(extension)) {
      toast({
        title: "صيغة الملف غير مدعومة",
        description: `الصيغ المقبولة حالياً: ${effectiveAllowedFormats.join(", ")}`,
        variant: "destructive",
      });
      return false;
    }

    if (file.size > maxFileSizeBytes) {
      toast({
        title: "حجم الملف أكبر من المسموح",
        description: `الحد الأقصى لرفع الملفات هو ${settings.maxUploadSizeMb} ميجابايت.`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleChooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) {
      return;
    }

    if (!validateFile(nextFile)) {
      event.target.value = "";
      return;
    }

    setSubmittedId(null);
    setSelectedFile(nextFile);
  };

  const handleDownloadAttachment = async (attachmentId: string, filePath: string | null) => {
    if (!filePath) {
      toast({
        title: "المرفق غير متاح للتنزيل",
        description: "هذا المرفق محفوظ وصفياً فقط في الوضع المحلي الحالي.",
        variant: "destructive",
      });
      return;
    }

    setDownloadingAttachmentId(attachmentId);

    try {
      const signedUrl = await createAssignmentAttachmentSignedUrl(filePath);
      if (!signedUrl) {
        toast({
          title: "تعذر فتح المرفق",
          description: "حدث خطأ أثناء تجهيز رابط التنزيل المؤقت.",
          variant: "destructive",
        });
        return;
      }

      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !hasCompatibleFormats) {
      return;
    }

    setSubmitting(true);

    try {
      const useSupabaseUpload = authMode === "supabase" && isSupabaseConfigured();
      let filePayload = {
        fileName: selectedFile.name,
        filePath: existingSubmission?.filePath ?? null,
        fileMimeType: selectedFile.type || "",
        fileSize: formatFileSize(selectedFile.size),
      };

      if (useSupabaseUpload) {
        const uploadedFile = await uploadSupabaseSubmissionFile({
          userId: user.id,
          assignmentId: assignment.id,
          file: selectedFile,
          previousPath: existingSubmission?.filePath,
        });

        if (!uploadedFile) {
          toast({
            title: "تعذر رفع الملف",
            description: "حدث خطأ أثناء إرسال الملف إلى التخزين السحابي.",
            variant: "destructive",
          });
          return;
        }

        filePayload = uploadedFile;
      }

      const savedSubmission = await submitAssignment({
        assignmentId: assignment.id,
        fileName: filePayload.fileName,
        filePath: filePayload.filePath,
        fileMimeType: filePayload.fileMimeType,
        fileSize: filePayload.fileSize,
        notes,
      });

      if (!savedSubmission) {
        toast({
          title: "تعذر حفظ التسليم",
          description: "حدث خطأ أثناء حفظ بيانات التسليم.",
          variant: "destructive",
        });
        return;
      }

      setSubmittedId(savedSubmission.id);
      resetSelectedFile();

      toast({
        title: "تم رفع التكليف بنجاح",
        description:
          savedSubmission.analysisStatus === "completed"
            ? "تم حفظ التسليم وتحديث نتيجة الأصالة."
            : "تم حفظ التسليم وبدأت معالجة الأصالة تلقائياً.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedId) {
    return (
      <div className="mx-auto max-w-lg animate-fade-in py-20 text-center">
        <div className="mx-auto mb-6 w-fit rounded-2xl bg-success/10 p-4">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h1 className="mb-2 text-h1 font-bold">تم التسليم بنجاح</h1>
        <p className="mb-6 text-muted-foreground">
          تم حفظ الملف وبدء دورة المراجعة، ويمكنك متابعة حالة التحليل والتقييم الآن.
        </p>
        <div className="flex justify-center gap-3">
          <Link to={`/student/status?assignment=${assignment.id}`}>
            <Button className="rounded-xl shadow-button">متابعة الحالة</Button>
          </Link>
          <Link to={`/student/originality?assignment=${assignment.id}`}>
            <Button variant="outline" className="rounded-xl">
              نتيجة الأصالة
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold">رفع تكليف</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          اختر الملف النهائي ثم أرسل النسخة المعتمدة للمراجعة والتحليل.
        </p>
      </div>

      {studentAssignments.length > 1 && (
        <div className="rounded-2xl bg-card p-5 shadow-card">
          <div className="space-y-2">
            <Label htmlFor="assignment-switcher">اختر التكليف الذي تريد الرفع له</Label>
            <Select
              value={assignment.id}
              onValueChange={(value) => setSearchParams({ assignment: value })}
            >
              <SelectTrigger id="assignment-switcher" className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {studentAssignments.map((item) => {
                  const submission = getStudentSubmission(user.id, item.id);
                  const optionLabel = `${shortenAssignmentText(item.subject, 20)} - ${shortenAssignmentText(item.title, 26)}${submission ? " - تم الرفع" : ""}`;
                  return (
                    <SelectItem key={item.id} value={item.id} title={`${item.subject} - ${item.title}`}>
                      {optionLabel}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              اختر المادة والتكليف الصحيحين قبل رفع الملف. تغيير الاختيار يبدل صفحة الرفع لنفس التكليف مباشرة.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-card p-6 shadow-card">
        <h2 className="mb-3 font-semibold">تفاصيل التكليف</h2>
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">التكليف:</span>
            <p className="mt-0.5 break-words font-medium" title={assignment.title}>
              {assignment.title}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">المادة:</span>
            <p className="mt-0.5 break-words font-medium" title={assignment.subject}>
              {assignment.subject}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">الموعد النهائي:</span>
            <p className="mt-0.5 font-medium tabular-nums">{formatDateLabel(assignment.dueAt)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">صيغ التسليم:</span>
            <p className="mt-0.5 font-medium">{assignment.allowedFormats.join(", ")}</p>
          </div>
          <div>
            <span className="text-muted-foreground">السياسة المؤسسية:</span>
            <p className="mt-0.5 font-medium">{settings.allowedSubmissionFormats.join(", ")}</p>
          </div>
          <div>
            <span className="text-muted-foreground">الحد الأقصى للحجم:</span>
            <p className="mt-0.5 font-medium">{settings.maxUploadSizeMb} ميجابايت</p>
          </div>
        </div>

        {!hasCompatibleFormats && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              لا توجد صيغ متوافقة حالياً بين إعدادات المؤسسة وهذا التكليف. تواصل مع المعلم أو الإدارة قبل محاولة الرفع.
            </div>
          </div>
        )}

        {existingSubmission && (
          <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            لديك تسليم سابق لهذا التكليف. رفع ملف جديد سيستبدل النسخة الحالية ويبدأ تحليلاً جديداً.
          </div>
        )}

        {assignment.attachments.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-primary" />
              <h3 className="font-medium">مرفقات التكليف</h3>
            </div>

            <div className="space-y-2">
              {assignment.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                    <p className="text-xs text-muted-foreground">{attachment.fileSize || "بدون حجم محدد"}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={downloadingAttachmentId === attachment.id || !hasDownloadableAttachments}
                    onClick={() => {
                      void handleDownloadAttachment(attachment.id, attachment.filePath);
                    }}
                  >
                    {downloadingAttachmentId === attachment.id ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    تنزيل
                  </Button>
                </div>
              ))}
            </div>

            {!hasDownloadableAttachments && (
              <p className="mt-3 text-xs text-muted-foreground">
                هذه المرفقات ظاهرة لك داخل الواجهة، لكن التنزيل الكامل يتطلب تفعيل التخزين السحابي في Supabase.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-card p-6 shadow-card">
        <h2 className="mb-4 font-semibold">رفع الملف</h2>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedExtensions}
          className="hidden"
          onChange={handleChooseFile}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={submitting || !hasCompatibleFormats}
          className={cn(
            "w-full rounded-2xl border-2 border-dashed p-12 text-center transition-colors",
            (submitting || !hasCompatibleFormats) && "cursor-not-allowed opacity-80",
            selectedFile
              ? "border-success bg-success/5"
              : "border-border hover:border-primary hover:bg-primary/5",
            !hasCompatibleFormats && "border-destructive/40 bg-destructive/5 hover:border-destructive/40 hover:bg-destructive/5",
          )}
        >
          <Upload
            className={cn(
              "mx-auto mb-4 h-10 w-10",
              selectedFile ? "text-success" : "text-muted-foreground",
            )}
          />
          <p className="mb-1 text-sm font-medium">
            {selectedFile
              ? "تم اختيار الملف بنجاح"
              : hasCompatibleFormats
                ? "انقر لاختيار ملف التسليم"
                : "الرفع متوقف حتى تتطابق سياسة الصيغ"}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasCompatibleFormats
              ? `${effectiveAllowedFormats.join(", ")} - الحد الأقصى ${settings.maxUploadSizeMb} ميجابايت`
              : "لا توجد صيغ مقبولة حالياً لهذا التكليف"}
          </p>
        </button>

        {selectedFile && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div className="text-right">
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetSelectedFile}
                className="rounded-lg p-1 hover:bg-background"
                disabled={submitting}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  submitting ? "w-2/3 animate-pulse bg-primary" : "w-full bg-success",
                )}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {authMode === "supabase" && isSupabaseConfigured()
                ? "سيتم رفع الملف إلى التخزين السحابي ثم بدء تحليل الأصالة تلقائياً."
                : "الوضع الحالي تجريبي محلياً، وسيتم حفظ بيانات الملف داخل التطبيق."}
            </p>
          </div>
        )}

        <div className="mt-6 space-y-2">
          <Label>ملاحظات إضافية</Label>
          <Textarea
            placeholder="أضف أي ملاحظات تريد إيصالها للمعلم..."
            className="min-h-[100px] rounded-xl"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={submitting}
          />
        </div>

        <Button
          disabled={!selectedFile || submitting || !hasCompatibleFormats}
          onClick={() => {
            void handleSubmit();
          }}
          className="mt-6 h-11 w-full rounded-xl shadow-button"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              جارٍ رفع الملف وحفظ التسليم...
            </span>
          ) : (
            "تأكيد التسليم"
          )}
        </Button>
      </div>
    </div>
  );
}
