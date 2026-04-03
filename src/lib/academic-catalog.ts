import type { UserRole } from "@/lib/auth";

export interface AcademicCatalogSubjectSeed {
  code: string;
  nameAr: string;
  nameEn: string;
  department: string;
  level: string;
  semester: string;
}

export const ACADEMIC_LEVEL_OPTIONS = [
  "المستوى الأول",
  "المستوى الثاني",
  "المستوى الثالث",
  "المستوى الرابع",
  "المستوى الخامس",
  "المستوى السادس",
  "المستوى السابع",
  "المستوى الثامن",
] as const;

export const ACADEMIC_TERM_OPTIONS = [
  "الفصل الأول",
  "الفصل الثاني",
  "الفصل الصيفي",
] as const;

export const ACADEMIC_DEPARTMENT_OPTIONS = [
  "تقنية المعلومات",
  "علوم الحاسوب",
  "نظم المعلومات",
  "هندسة البرمجيات",
  "إدارة الأعمال",
  "المحاسبة",
  "التسويق",
  "اللغة الإنجليزية",
  "التصميم الجرافيكي",
  "التمريض",
] as const;

export const ADMIN_DEPARTMENT_OPTIONS = [
  "إدارة النظام",
  "عمادة القبول والتسجيل",
  "عمادة التعلم الإلكتروني",
  "الشؤون الأكاديمية",
  ...ACADEMIC_DEPARTMENT_OPTIONS,
] as const;

export const ACADEMIC_SUBJECT_SEEDS: AcademicCatalogSubjectSeed[] = [
  {
    code: "IT101",
    nameAr: "مقدمة في تقنية المعلومات",
    nameEn: "Introduction to Information Technology",
    department: "تقنية المعلومات",
    level: "المستوى الأول",
    semester: "الفصل الأول",
  },
  {
    code: "IT221",
    nameAr: "شبكات الحاسوب",
    nameEn: "Computer Networks",
    department: "تقنية المعلومات",
    level: "المستوى الثاني",
    semester: "الفصل الثاني",
  },
  {
    code: "IT331",
    nameAr: "أمن المعلومات",
    nameEn: "Information Security",
    department: "تقنية المعلومات",
    level: "المستوى الثالث",
    semester: "الفصل الأول",
  },
  {
    code: "CS101",
    nameAr: "برمجة 1",
    nameEn: "Programming 1",
    department: "علوم الحاسوب",
    level: "المستوى الأول",
    semester: "الفصل الأول",
  },
  {
    code: "CS202",
    nameAr: "هياكل البيانات",
    nameEn: "Data Structures",
    department: "علوم الحاسوب",
    level: "المستوى الثاني",
    semester: "الفصل الثاني",
  },
  {
    code: "CS431",
    nameAr: "الذكاء الاصطناعي",
    nameEn: "Artificial Intelligence",
    department: "علوم الحاسوب",
    level: "المستوى الرابع",
    semester: "الفصل الأول",
  },
  {
    code: "IS301",
    nameAr: "تحليل وتصميم النظم",
    nameEn: "Systems Analysis and Design",
    department: "نظم المعلومات",
    level: "المستوى الثالث",
    semester: "الفصل الأول",
  },
  {
    code: "IS302",
    nameAr: "قواعد البيانات",
    nameEn: "Databases",
    department: "نظم المعلومات",
    level: "المستوى الثالث",
    semester: "الفصل الثاني",
  },
  {
    code: "IS411",
    nameAr: "نظم تخطيط الموارد",
    nameEn: "Enterprise Resource Planning",
    department: "نظم المعلومات",
    level: "المستوى الرابع",
    semester: "الفصل الأول",
  },
  {
    code: "SE301",
    nameAr: "هندسة البرمجيات",
    nameEn: "Software Engineering",
    department: "هندسة البرمجيات",
    level: "المستوى الثالث",
    semester: "الفصل الأول",
  },
  {
    code: "SE402",
    nameAr: "اختبار البرمجيات",
    nameEn: "Software Testing",
    department: "هندسة البرمجيات",
    level: "المستوى الرابع",
    semester: "الفصل الأول",
  },
  {
    code: "SE404",
    nameAr: "إدارة المشاريع البرمجية",
    nameEn: "Software Project Management",
    department: "هندسة البرمجيات",
    level: "المستوى الرابع",
    semester: "الفصل الثاني",
  },
  {
    code: "BA101",
    nameAr: "مبادئ الإدارة",
    nameEn: "Principles of Management",
    department: "إدارة الأعمال",
    level: "المستوى الأول",
    semester: "الفصل الأول",
  },
  {
    code: "BA221",
    nameAr: "إدارة الموارد البشرية",
    nameEn: "Human Resources Management",
    department: "إدارة الأعمال",
    level: "المستوى الثاني",
    semester: "الفصل الثاني",
  },
  {
    code: "BA331",
    nameAr: "الإدارة الاستراتيجية",
    nameEn: "Strategic Management",
    department: "إدارة الأعمال",
    level: "المستوى الثالث",
    semester: "الفصل الأول",
  },
  {
    code: "ACC101",
    nameAr: "مبادئ المحاسبة",
    nameEn: "Principles of Accounting",
    department: "المحاسبة",
    level: "المستوى الأول",
    semester: "الفصل الأول",
  },
  {
    code: "ACC201",
    nameAr: "المحاسبة المالية",
    nameEn: "Financial Accounting",
    department: "المحاسبة",
    level: "المستوى الثاني",
    semester: "الفصل الأول",
  },
  {
    code: "ACC301",
    nameAr: "المحاسبة الإدارية",
    nameEn: "Managerial Accounting",
    department: "المحاسبة",
    level: "المستوى الثالث",
    semester: "الفصل الثاني",
  },
  {
    code: "MKT101",
    nameAr: "مبادئ التسويق",
    nameEn: "Principles of Marketing",
    department: "التسويق",
    level: "المستوى الأول",
    semester: "الفصل الأول",
  },
  {
    code: "MKT222",
    nameAr: "التسويق الرقمي",
    nameEn: "Digital Marketing",
    department: "التسويق",
    level: "المستوى الثاني",
    semester: "الفصل الثاني",
  },
  {
    code: "MKT315",
    nameAr: "سلوك المستهلك",
    nameEn: "Consumer Behavior",
    department: "التسويق",
    level: "المستوى الثالث",
    semester: "الفصل الأول",
  },
  {
    code: "ENG101",
    nameAr: "مهارات القراءة",
    nameEn: "Reading Skills",
    department: "اللغة الإنجليزية",
    level: "المستوى الأول",
    semester: "الفصل الأول",
  },
  {
    code: "ENG102",
    nameAr: "مهارات الكتابة",
    nameEn: "Writing Skills",
    department: "اللغة الإنجليزية",
    level: "المستوى الأول",
    semester: "الفصل الثاني",
  },
  {
    code: "ENG203",
    nameAr: "الترجمة",
    nameEn: "Translation",
    department: "اللغة الإنجليزية",
    level: "المستوى الثاني",
    semester: "الفصل الثاني",
  },
  {
    code: "GD101",
    nameAr: "مبادئ التصميم",
    nameEn: "Design Principles",
    department: "التصميم الجرافيكي",
    level: "المستوى الأول",
    semester: "الفصل الأول",
  },
  {
    code: "GD215",
    nameAr: "تصميم الهوية البصرية",
    nameEn: "Visual Identity Design",
    department: "التصميم الجرافيكي",
    level: "المستوى الثاني",
    semester: "الفصل الأول",
  },
  {
    code: "GD320",
    nameAr: "تصميم الإعلانات",
    nameEn: "Advertising Design",
    department: "التصميم الجرافيكي",
    level: "المستوى الثالث",
    semester: "الفصل الثاني",
  },
  {
    code: "NUR101",
    nameAr: "أساسيات التمريض",
    nameEn: "Fundamentals of Nursing",
    department: "التمريض",
    level: "المستوى الأول",
    semester: "الفصل الأول",
  },
  {
    code: "NUR221",
    nameAr: "تمريض الباطنة والجراحة",
    nameEn: "Medical Surgical Nursing",
    department: "التمريض",
    level: "المستوى الثاني",
    semester: "الفصل الثاني",
  },
  {
    code: "NUR331",
    nameAr: "صحة الأم والطفل",
    nameEn: "Maternal and Child Health",
    department: "التمريض",
    level: "المستوى الثالث",
    semester: "الفصل الأول",
  },
];

export function getDepartmentOptionsForRole(role: UserRole) {
  return role === "admin" ? ADMIN_DEPARTMENT_OPTIONS : ACADEMIC_DEPARTMENT_OPTIONS;
}

