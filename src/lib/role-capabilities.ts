import type { UserRole } from "@/lib/auth";

export interface RoleCapability {
  id: string;
  label: string;
  description: string;
  access: Record<UserRole, boolean>;
}

export interface RoleWorkspace {
  role: UserRole;
  title: string;
  description: string;
  routes: Array<{ label: string; href: string }>;
}

export const roleLabels: Record<UserRole, string> = {
  student: "طالب",
  teacher: "معلم",
  admin: "مسؤول",
};

export const roleDescriptions: Record<UserRole, string> = {
  student: "يرفع التكليفات ويتابع التحليل والنتائج والقرارات النهائية على ملفاته فقط.",
  teacher: "ينشئ التكليفات ويراجع التسليمات ويطّلع على تفاصيل الأصالة ويصدر القرار الأكاديمي.",
  admin: "يراقب النظام بالكامل ويدير المستخدمين والبنية الأكاديمية وقضايا الأصالة والإعدادات.",
};

export const roleCapabilities: RoleCapability[] = [
  {
    id: "dashboard_access",
    label: "الوصول إلى البوابة الرئيسية",
    description: "الدخول إلى لوحة الدور والتنقل داخل صفحات العمل الخاصة به.",
    access: { student: true, teacher: true, admin: true },
  },
  {
    id: "assignment_visibility",
    label: "عرض التكليفات والمواد المرتبطة",
    description: "استعراض التكليفات أو الهيكل الأكاديمي وفق نطاق الوصول المخصص لكل دور.",
    access: { student: true, teacher: true, admin: true },
  },
  {
    id: "assignment_creation",
    label: "إنشاء ونشر التكليفات",
    description: "إعداد التكليفات وتحديد تعليماتها ومواعيدها ونشرها للطلاب.",
    access: { student: false, teacher: true, admin: true },
  },
  {
    id: "submission_upload",
    label: "رفع ملفات الحلول",
    description: "رفع ملفات PDF أو DOCX وإرسالها للتحليل ضمن التكليفات المتاحة.",
    access: { student: true, teacher: false, admin: false },
  },
  {
    id: "submission_review",
    label: "مراجعة التسليمات والحالات",
    description: "الوصول إلى قائمة التسليمات، حالات التحليل، وسجل المراجعة.",
    access: { student: false, teacher: true, admin: true },
  },
  {
    id: "originality_safe_summary",
    label: "عرض ملخص الأصالة الآمن",
    description: "مشاهدة النتيجة العامة والملخص المختصر دون كشف أسماء أو مقاطع تفصيلية.",
    access: { student: true, teacher: true, admin: true },
  },
  {
    id: "originality_detailed_evidence",
    label: "عرض التطابقات والمقاطع التفصيلية",
    description: "الوصول إلى المقاطع المشبوهة والطلاب المتشابهين وتوصيات التحليل.",
    access: { student: false, teacher: true, admin: true },
  },
  {
    id: "grading_and_decision",
    label: "التقييم وإصدار القرار النهائي",
    description: "تسجيل الدرجة وقرار مقبول أو غير مقبول أو يحتاج تعديل بعد المراجعة.",
    access: { student: false, teacher: true, admin: true },
  },
  {
    id: "analytics_and_cases",
    label: "متابعة التحليلات وقضايا الأصالة",
    description: "عرض القضايا المشبوهة والمؤشرات والإحصاءات المرتبطة بالأصالة.",
    access: { student: false, teacher: true, admin: true },
  },
  {
    id: "user_and_role_management",
    label: "إدارة المستخدمين والأدوار",
    description: "متابعة الحسابات الحالية، الأدوار، وحالات تغيير كلمة المرور.",
    access: { student: false, teacher: false, admin: true },
  },
  {
    id: "system_configuration",
    label: "إعدادات النظام والسياسات",
    description: "ضبط إعدادات النظام العامة ومتابعة التكوينات الإدارية.",
    access: { student: false, teacher: false, admin: true },
  },
];

export const roleWorkspaces: RoleWorkspace[] = [
  {
    role: "student",
    title: "بوابة الطالب",
    description: "واجهة التسليم والمتابعة الشخصية للطالب داخل المواد والتكليفات المتاحة له.",
    routes: [
      { label: "لوحة التحكم", href: "/student" },
      { label: "المواد الدراسية", href: "/student/subjects" },
      { label: "التكليفات", href: "/student/assignments" },
      { label: "رفع تكليف", href: "/student/upload" },
      { label: "حالة التسليم", href: "/student/status" },
      { label: "الأصالة", href: "/student/originality" },
      { label: "الدرجات والتقييم", href: "/student/grades" },
      { label: "السجل", href: "/student/history" },
      { label: "التقويم", href: "/student/calendar" },
    ],
  },
  {
    role: "teacher",
    title: "بوابة المعلم",
    description: "واجهة إدارة التكليفات ومراجعة التحليل والتقييم الأكاديمي للتسليمات.",
    routes: [
      { label: "لوحة التحكم", href: "/teacher" },
      { label: "إنشاء تكليف", href: "/teacher/create-assignment" },
      { label: "إدارة التكليفات", href: "/teacher/assignments" },
      { label: "صندوق التسليمات", href: "/teacher/submissions" },
      { label: "مراجعة التسليم", href: "/teacher/review" },
      { label: "التحليلات", href: "/teacher/analytics" },
      { label: "قضايا الأصالة", href: "/teacher/reports" },
    ],
  },
  {
    role: "admin",
    title: "بوابة الإدارة",
    description: "واجهة الإشراف المؤسسي على المستخدمين والمواد والقضايا والإعدادات.",
    routes: [
      { label: "لوحة التحكم", href: "/admin" },
      { label: "إدارة المستخدمين", href: "/admin/users" },
      { label: "الأدوار والصلاحيات", href: "/admin/roles" },
      { label: "المواد والهيكل", href: "/admin/subjects" },
      { label: "سجل النشاطات", href: "/admin/activity" },
      { label: "قضايا الأصالة", href: "/admin/reports" },
      { label: "إعدادات النظام", href: "/admin/settings" },
    ],
  },
];
