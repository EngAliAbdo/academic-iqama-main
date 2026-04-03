import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Paperclip, Save, Send, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { type AssignmentAttachment } from "@/lib/academic-data";
import {
  formatFileSize,
  isSupabaseConfigured,
  removeSupabaseAssignmentAttachments,
  uploadSupabaseAssignmentAttachments,
} from "@/lib/supabase-app";

type SubmissionAction = "draft" | "published";

const ATTACHMENT_ACCEPT = ".pdf,.docx,.pptx";
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(["PDF", "DOCX", "PPTX"]);
const MAX_ATTACHMENT_COUNT = 3;

export default function TeacherCreateAssignment() {
  const navigate = useNavigate();
  const { createAssignment, getTeacherSubjects, subjects } = useAcademicData();
  const { user, authMode } = useAuth();
  const { settings } = useSystemSettings();
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("23:59");
  const [allowedFormats, setAllowedFormats] = useState<string[]>(settings.allowedSubmissionFormats);
  const [resubmissionPolicy, setResubmissionPolicy] = useState("replace_latest");
  const [maxSubmissions, setMaxSubmissions] = useState("2");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [submittingStatus, setSubmittingStatus] = useState<SubmissionAction | null>(null);

  const teacherSubjects = useMemo(() => {
    if (!user) {
      return [];
    }

    return getTeacherSubjects(user.id).filter((item) => item.status === "active");
  }, [getTeacherSubjects, user]);

  const availableSubjects = useMemo(() => {
    if (authMode === "supabase" && user?.role === "teacher") {
      return teacherSubjects;
    }

    if (teacherSubjects.length > 0) {
      return teacherSubjects;
    }

    return subjects.filter((item) => item.status === "active");
  }, [authMode, subjects, teacherSubjects, user?.role]);
  const requiresLinkedTeacherSubjects = authMode === "supabase" && user?.role === "teacher";
  const hasLinkedTeacherSubjects = availableSubjects.length > 0;

  const selectedSubject = useMemo(
    () => availableSubjects.find((item) => item.id === selectedSubjectId) ?? null,
    [availableSubjects, selectedSubjectId],
  );

  useEffect(() => {
    setAllowedFormats((current) => {
      const filtered = current.filter((format) => settings.allowedSubmissionFormats.includes(format));
      return filtered.length > 0 ? filtered : settings.allowedSubmissionFormats;
    });
  }, [settings.allowedSubmissionFormats]);

  useEffect(() => {
    if (availableSubjects.length === 0) {
      setSelectedSubjectId("");
      return;
    }

    setSelectedSubjectId((current) =>
      current && availableSubjects.some((item) => item.id === current)
        ? current
        : availableSubjects[0].id);
  }, [availableSubjects]);

  useEffect(() => {
    if (!selectedSubject) {
      return;
    }

    setSubject(selectedSubject.nameAr);
    setLevel(selectedSubject.level || "");
  }, [selectedSubject]);

  useEffect(() => {
    if (resubmissionPolicy === "single_attempt") {
      setMaxSubmissions("1");
    }
  }, [resubmissionPolicy]);

  const toggleFormat = (format: string, checked: boolean) => {
    setAllowedFormats((current) =>
      checked ? Array.from(new Set([...current, format])) : current.filter((item) => item !== format),
    );
  };

  const validateAttachment = (file: File) => {
    const extension = file.name.split(".").pop()?.toUpperCase() ?? "";

    if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
      toast({
        title: "صيغة المرفق غير مدعومة",
        description: "المرفقات المدعومة حالياً هي PDF وDOCX وPPTX.",
        variant: "destructive",
      });
      return false;
    }

    if (file.size > settings.maxUploadSizeMb * 1024 * 1024) {
      toast({
        title: "حجم المرفق أكبر من المسموح",
        description: `الحد الأقصى لكل مرفق هو ${settings.maxUploadSizeMb} ميجابايت.`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleAttachmentSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files ?? []);
    if (incomingFiles.length === 0) {
      return;
    }

    setAttachmentFiles((current) => {
      const nextFiles = [...current];

      for (const file of incomingFiles) {
        if (nextFiles.length >= MAX_ATTACHMENT_COUNT) {
          toast({
            title: "وصلت للحد الأعلى للمرفقات",
            description: `يمكنك إضافة ${MAX_ATTACHMENT_COUNT} مرفقات كحد أقصى لكل تكليف.`,
            variant: "destructive",
          });
          break;
        }

        const duplicate = nextFiles.some(
          (entry) =>
            entry.name === file.name
            && entry.size === file.size
            && entry.lastModified === file.lastModified,
        );

        if (duplicate) {
          continue;
        }

        if (validateAttachment(file)) {
          nextFiles.push(file);
        }
      }

      return nextFiles;
    });

    event.target.value = "";
  };

  const removeAttachment = (targetFile: File) => {
    setAttachmentFiles((current) =>
      current.filter(
        (file) =>
          !(
            file.name === targetFile.name
            && file.size === targetFile.size
            && file.lastModified === targetFile.lastModified
          ),
      ),
    );
  };

  const submit = async (status: SubmissionAction) => {
    if (!user) {
      return;
    }

    if (!title.trim() || !dueDate) {
      toast({
        title: "البيانات ناقصة",
        description: "أدخل عنوان التكليف وحدد تاريخ التسليم.",
        variant: "destructive",
      });
      return;
    }

    if (requiresLinkedTeacherSubjects && !hasLinkedTeacherSubjects) {
      toast({
        title: "لا توجد مواد مربوطة بحسابك",
        description: "اربط المعلم بمادة واحدة على الأقل من بوابة الإدارة قبل إنشاء تكليف جديد.",
        variant: "destructive",
      });
      return;
    }

    if (!(selectedSubject?.nameAr ?? subject).trim() || !(selectedSubject?.level ?? level).trim()) {
      toast({
        title: "البيانات ناقصة",
        description: "أدخل المادة والمستوى المستهدف قبل الحفظ.",
        variant: "destructive",
      });
      return;
    }

    if (settings.allowedSubmissionFormats.length === 0) {
      toast({
        title: "سياسة الصيغ غير مكتملة",
        description: "لا توجد صيغ رفع مفعلة حالياً في إعدادات النظام.",
        variant: "destructive",
      });
      return;
    }

    if (allowedFormats.length === 0) {
      toast({
        title: "اختر صيغة تسليم",
        description: "حدد صيغة واحدة على الأقل من الصيغ المعتمدة للمؤسسة.",
        variant: "destructive",
      });
      return;
    }

    if (!allowedFormats.every((format) => settings.allowedSubmissionFormats.includes(format))) {
      toast({
        title: "صيغة غير مدعومة",
        description: "بعض الصيغ المختارة غير معتمدة في إعدادات النظام الحالية.",
        variant: "destructive",
      });
      return;
    }

    const dueAt = new Date(`${dueDate}T${dueTime || "23:59"}:00`);
    if (Number.isNaN(dueAt.getTime())) {
      toast({
        title: "التاريخ غير صحيح",
        description: "تحقق من تاريخ ووقت التسليم.",
        variant: "destructive",
      });
      return;
    }

    const parsedMaxSubmissions = Number(maxSubmissions) || 1;
    if (parsedMaxSubmissions < 1 || parsedMaxSubmissions > 10) {
      toast({
        title: "عدد التسليمات غير صالح",
        description: "الحد الأقصى لمرات التسليم يجب أن يكون بين 1 و10.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingStatus(status);

    const useSupabaseUpload = authMode === "supabase" && isSupabaseConfigured();
    let attachments: AssignmentAttachment[] = attachmentFiles.map((file, index) => ({
      id: `local-attachment-${Date.now()}-${index + 1}`,
      fileName: file.name,
      filePath: null,
      fileMimeType: file.type || "",
      fileSize: formatFileSize(file.size),
      uploadedAt: new Date().toISOString(),
    }));
    let uploadedPaths: string[] = [];

    try {
      if (useSupabaseUpload && attachmentFiles.length > 0) {
        const uploadedAttachments = await uploadSupabaseAssignmentAttachments({
          userId: user.id,
          files: attachmentFiles,
        });

        if (!uploadedAttachments) {
          toast({
            title: "تعذر رفع المرفقات",
            description: "حدث خطأ أثناء إرسال مرفقات التكليف إلى التخزين السحابي.",
            variant: "destructive",
          });
          return;
        }

        attachments = uploadedAttachments;
        uploadedPaths = uploadedAttachments
          .map((attachment) => attachment.filePath)
          .filter((path): path is string => Boolean(path));
      }

      const created = await createAssignment({
        subjectId: selectedSubject?.id ?? null,
        title: title.trim(),
        subject: (selectedSubject?.nameAr ?? subject).trim(),
        level: (selectedSubject?.level ?? level).trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        dueAt: dueAt.toISOString(),
        allowedFormats,
        maxSubmissions: parsedMaxSubmissions,
        attachments,
        resubmissionPolicy,
        status,
      });

      if (!created) {
        if (uploadedPaths.length > 0) {
          await removeSupabaseAssignmentAttachments(uploadedPaths);
        }

        toast({
          title: "تعذر إنشاء التكليف",
          description: "حدث خطأ أثناء حفظ بيانات التكليف.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: status === "draft" ? "تم حفظ المسودة" : "تم نشر التكليف",
        description:
          created.attachments.length > 0
            ? `تم حفظ ${created.attachments.length} مرفقات مع التكليف.`
            : status === "draft"
              ? "يمكنك إكماله لاحقاً."
              : "ظهر التكليف مباشرة في قوائم الطالب.",
      });
      navigate("/teacher/assignments");
    } finally {
      setSubmittingStatus(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold">إنشاء تكليف جديد</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          حدّد تفاصيل التكليف، واربطه بمادة فعلية من دليل المواد متى كانت متاحة.
        </p>
      </div>

      <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
        <div className="space-y-5 rounded-2xl bg-card p-6 shadow-card">
          <h2 className="font-semibold">المعلومات الأساسية</h2>

          <div className="space-y-2">
            <Label htmlFor="assignment-title">عنوان التكليف</Label>
            <Input
              id="assignment-title"
              placeholder="مثال: بحث في الذكاء الاصطناعي"
              className="h-11 rounded-xl"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>المادة</Label>
              {availableSubjects.length > 0 ? (
                <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="اختر مادة" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nameAr}
                        {item.code ? ` - ${item.code}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : requiresLinkedTeacherSubjects ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                  لا توجد مواد مربوطة بحسابك حاليًا. اطلب من الإدارة ربطك بالمادة أولًا من شاشة
                  المستخدمين أو من إدارة المواد.
                </div>
              ) : (
                <Input
                  className="h-11 rounded-xl"
                  value={subject}
                  placeholder="أدخل اسم المادة"
                  onChange={(event) => setSubject(event.target.value)}
                />
              )}
              {selectedSubject && (
                <p className="text-xs text-muted-foreground">
                  {selectedSubject.department}
                  {selectedSubject.semester ? ` • ${selectedSubject.semester}` : ""}
                </p>
              )}
              {availableSubjects.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {requiresLinkedTeacherSubjects
                    ? "في وضع Supabase الحي لا يمكن إنشاء التكليف حتى يتم ربط المعلم بمادة واحدة على الأقل."
                    : "لا توجد مواد مربوطة بك حالياً، لذلك سيُحفظ اسم المادة كنص فقط إلى أن يكتمل دليل المواد."}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignment-level">المستوى المستهدف</Label>
              <Input
                id="assignment-level"
                className="h-11 rounded-xl"
                value={selectedSubject?.level ?? level}
                placeholder="مثال: المستوى السادس"
                readOnly={Boolean(selectedSubject?.level)}
                onChange={(event) => setLevel(event.target.value)}
              />
            </div>
          </div>

          {selectedSubject && (
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">نطاق التكليف</h3>
                  <p className="text-xs text-muted-foreground">
                    سيتاح هذا التكليف لجميع الطلاب المسجلين في هذه المادة.
                  </p>
                </div>
                {selectedSubject.code && (
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                    {selectedSubject.code}
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">المادة</p>
                  <p className="mt-1 text-sm font-medium">{selectedSubject.nameAr}</p>
                </div>
                <div className="rounded-xl bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">القسم</p>
                  <p className="mt-1 text-sm font-medium">{selectedSubject.department || "غير محدد"}</p>
                </div>
                <div className="rounded-xl bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">المستوى</p>
                  <p className="mt-1 text-sm font-medium">{selectedSubject.level || level || "غير محدد"}</p>
                </div>
                <div className="rounded-xl bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">الوصول</p>
                  <p className="mt-1 text-sm font-medium">كل الطلاب المسجلين في المادة</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="assignment-description">الوصف</Label>
            <Textarea
              id="assignment-description"
              placeholder="وصف عام للتكليف..."
              className="min-h-[80px] rounded-xl"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignment-instructions">التعليمات التفصيلية</Label>
            <Textarea
              id="assignment-instructions"
              placeholder="تعليمات واضحة للطلاب حول كيفية إنجاز التكليف..."
              className="min-h-[120px] rounded-xl"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-5 rounded-2xl bg-card p-6 shadow-card">
          <h2 className="font-semibold">إعدادات التسليم</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assignment-due-date">الموعد النهائي</Label>
              <Input
                id="assignment-due-date"
                type="date"
                className="h-11 rounded-xl"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-due-time">الوقت</Label>
              <Input
                id="assignment-due-time"
                type="time"
                className="h-11 rounded-xl"
                value={dueTime}
                onChange={(event) => setDueTime(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>سياسة إعادة التسليم</Label>
              <Select value={resubmissionPolicy} onValueChange={setResubmissionPolicy}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="replace_latest">يسمح بإعادة الرفع مع استبدال آخر نسخة</SelectItem>
                  <SelectItem value="multiple_attempts">يسمح بعدة محاولات حتى الحد المحدد</SelectItem>
                  <SelectItem value="single_attempt">محاولة واحدة فقط</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignment-max-submissions">الحد الأقصى للتسليمات</Label>
              <Input
                id="assignment-max-submissions"
                type="number"
                min={1}
                max={10}
                className="h-11 rounded-xl"
                value={maxSubmissions}
                disabled={resubmissionPolicy === "single_attempt"}
                onChange={(event) => setMaxSubmissions(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                الحد الأقصى لحجم الملف لكل تسليم حالياً: {settings.maxUploadSizeMb} ميجابايت.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>الصيغ المسموح بها</Label>
            <div className="space-y-3 rounded-2xl border border-border p-4">
              {settings.allowedSubmissionFormats.map((format) => (
                <label key={format} className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{format}</p>
                    <p className="text-xs text-muted-foreground">
                      متاح ضمن سياسة الرفع المعتمدة في النظام.
                    </p>
                  </div>
                  <Checkbox
                    checked={allowedFormats.includes(format)}
                    onCheckedChange={(checked) => toggleFormat(format, checked === true)}
                    aria-label={`اختيار صيغة ${format}`}
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              لا يمكن اختيار صيغ خارج إعدادات المؤسسة الحالية.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">مرفقات التكليف</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  أضف حتى {MAX_ATTACHMENT_COUNT} ملفات داعمة بصيغ PDF أو DOCX أو PPTX.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={submittingStatus !== null || attachmentFiles.length >= MAX_ATTACHMENT_COUNT}
                onClick={() => attachmentInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                إضافة مرفق
              </Button>
            </div>

            <input
              ref={attachmentInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              multiple
              className="hidden"
              onChange={handleAttachmentSelection}
            />

            <div className="rounded-2xl border-2 border-dashed border-border px-5 py-6 text-center">
              <Paperclip className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium">
                {attachmentFiles.length > 0
                  ? `تم اختيار ${attachmentFiles.length} مرفقات`
                  : "أرفق ملفات الإرشادات أو القوالب أو مواد الدعم"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {authMode === "supabase" && isSupabaseConfigured()
                  ? "سيتم رفع المرفقات إلى التخزين السحابي وربطها بالتكليف مباشرة."
                  : "في الوضع المحلي سيتم حفظ بيانات المرفقات داخل التطبيق فقط."}
              </p>
            </div>

            {attachmentFiles.length > 0 && (
              <div className="space-y-2">
                {attachmentFiles.map((file) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="flex items-center justify-between rounded-xl bg-muted px-4 py-3"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <Paperclip className="h-4 w-4 text-primary" />
                      <div className="min-w-0 text-right">
                        <p className="truncate text-sm font-medium" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg p-1 transition-colors hover:bg-background"
                      disabled={submittingStatus !== null}
                      onClick={() => removeAttachment(file)}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {requiresLinkedTeacherSubjects && !hasLinkedTeacherSubjects
            ? "لن تتمكن من الحفظ أو النشر حتى تربط الإدارة حسابك بمادة واحدة على الأقل."
            : "يمكنك حفظ التكليف كمسودة أولًا أو نشره مباشرة للطلاب المطابقين لنطاقه."}
        </p>

        <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-card backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1 gap-2 rounded-xl"
            disabled={
              submittingStatus !== null
              || (requiresLinkedTeacherSubjects && !hasLinkedTeacherSubjects)
            }
            onClick={() => {
              void submit("draft");
            }}
          >
            <Save className="h-4 w-4" />
            {submittingStatus === "draft" ? "جارٍ الحفظ..." : "حفظ كمسودة"}
          </Button>
          <Button
            type="button"
            className="flex-1 gap-2 rounded-xl shadow-button"
            disabled={
              submittingStatus !== null
              || (requiresLinkedTeacherSubjects && !hasLinkedTeacherSubjects)
            }
            onClick={() => {
              void submit("published");
            }}
          >
            <Send className="h-4 w-4" />
            {submittingStatus === "published" ? "جارٍ النشر..." : "نشر التكليف"}
          </Button>
        </div>
      </form>
    </div>
  );
}
