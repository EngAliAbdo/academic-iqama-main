# UI_MAP

## مقدمة
هذا الملف يسجل الشاشات المكتشفة من `src/App.tsx` ويربط كل شاشة بملفها، نوعها، وظائفها، والبيانات التي تعرضها أو تعدلها.

## صفحات عامة ومشتركة
| الشاشة | المسار | الملف | النوع | العناصر الأساسية | ماذا يفعل المستخدم | البيانات/الخدمات |
|---|---|---|---|---|---|---|
| الصفحة الافتتاحية | `/` | `src/pages/LandingPage.tsx` | public | hero, sections, CTA | ينتقل لتسجيل الدخول | لا تعتمد على بيانات أكاديمية |
| تسجيل الدخول | `/login` | `src/pages/LoginPage.tsx` | public auth | حقلا identifier/password، زر دخول، رسائل خطأ | تسجيل الدخول | `useAuth().signIn` |
| استعادة كلمة المرور | `/forgot-password` | `src/pages/ForgotPasswordPage.tsx` | public auth | identifier input، submit | طلب reset password | `resolve_login_identifier`, `supabase.auth.resetPasswordForEmail` |
| تغيير كلمة المرور | `/change-password` | `src/pages/ChangePasswordPage.tsx` | private shared | password form، validation | تغيير كلمة المرور | `useAuth().changePassword` |
| الإشعارات | `/notifications` | `src/pages/NotificationsPage.tsx` | private shared | filters، mark read، mark all | قراءة وإدارة الإشعارات | `useNotificationsContext` |
| الملف الشخصي | `/profile` | `src/pages/ProfilePage.tsx` | private shared | بطاقة الملف الشخصي | عرض بيانات الحساب | `useAuth`, `directoryUsers` |
| الإعدادات | `/settings` | `src/pages/SettingsPage.tsx` | private shared | theme toggle، notification prefs، security summary | ضبط الثيم والتنبيهات | `useTheme`, `user-preferences`, `useNotifications` |
| 404 | `*` | `src/pages/NotFound.tsx` | fallback | رسالة عدم العثور | الرجوع أو التنقل | لا شيء |

## صفحات الطالب
| الشاشة | المسار | الملف | النوع | العناصر الأساسية | العمليات | الخدمات/العلاقات |
|---|---|---|---|---|---|---|
| لوحة الطالب | `/student` | `StudentDashboard.tsx` | private student dashboard | stat cards، latest submissions، upcoming deadlines | الانتقال للمواد/الرفع/التكليفات | `getStudentAssignments`, `getStudentSubmissions` |
| المواد الدراسية | `/student/subjects` | `StudentSubjects.tsx` | private student | search، subject cards | فتح تكليفات المادة | subject summaries من assignments/submissions/subjects |
| التكليفات | `/student/assignments` | `StudentAssignments.tsx` | private student | search، filters، table/list، status badges | رفع أو متابعة التكليف | يقرأ `getStudentAssignments` ويرتبط بـ upload/status |
| رفع تكليف | `/student/upload` | `StudentUpload.tsx` | private student workflow | assignment selector، details، attachment downloads، file input، submit | رفع ملف تسليم | `submitAssignment`, storage signed URLs |
| حالة التسليم | `/student/status` | `StudentStatus.tsx` | private student workflow | refresh، timeline، state cards | متابعة حالة التحليل/القرار | `getStudentSubmissions`, links to originality/grades/reupload |
| الأصالة | `/student/originality` | `StudentOriginality.tsx` | private student report | assignment selector، gauge، summary، states | الاطلاع على نتيجة الأصالة | originality checks + review notes |
| الدرجات والتقييم | `/student/grades` | `StudentGrades.tsx` | private student report | assignment selector، grade card، feedback | رؤية الدرجة والتغذية الراجعة | submissions + assignments |
| سجل التسليمات | `/student/history` | `StudentHistory.tsx` | private student archive | filter، search، history table | فتح حالة التسليم | `getStudentSubmissions` |
| التقويم | `/student/calendar` | `StudentCalendar.tsx` | private student calendar | monthly calendar، event chips، upcoming due cards | التنقل لتسليم/حالة/أصالة/نتيجة | assignments + submissions + reviews |

## صفحات المعلم
| الشاشة | المسار | الملف | النوع | العناصر الأساسية | العمليات | الخدمات/العلاقات |
|---|---|---|---|---|---|---|
| لوحة المعلم | `/teacher` | `TeacherDashboard.tsx` | private teacher dashboard | KPI cards، recent activities، submissions trend | فتح الإنشاء/التكليفات/المراجعات/التقارير | teacher submissions/assignments |
| إنشاء تكليف | `/teacher/create-assignment` | `TeacherCreateAssignment.tsx` | private teacher form | title, subject, level, description, instructions, due date/time, formats, resubmission policy, attachments, draft/publish | إنشاء تكليف | `createAssignment`, upload attachments, system settings |
| إدارة التكليفات | `/teacher/assignments` | `TeacherAssignments.tsx` | private teacher | search، assignment table، status | فتح صندوق التسليمات المفلتر | teacher assignments + submission counts |
| صندوق التسليمات | `/teacher/submissions` | `TeacherSubmissions.tsx` | private teacher | refresh، filters، search، table، start analysis، review action | بدء التحليل/فتح المراجعة | teacher submissions + `startSubmissionAnalysis` |
| مراجعة التسليم | `/teacher/review` | `TeacherReview.tsx` | private teacher workflow | preview/download، student info، originality summary، suspicious passages، internal matches، teacher decision panel، grade/comments | حفظ القرار، تنزيل الملف، بدء/إعادة التحليل | `reviewSubmission`, `startSubmissionAnalysis`, signed URLs |
| التحليلات | `/teacher/analytics` | `TeacherAnalytics.tsx` | private teacher analytics | charts، KPI summary، top assignments | قراءة تحليل الأداء | read-only over teacher submissions |
| قضايا الأصالة | `/teacher/reports` | `TeacherReports.tsx` | private teacher reporting | export PDF/Excel، cards filters، chips، search، table | تصفية الحالات وفتح المراجعة | submissions + originality + review summaries |

## صفحات الإدارة
| الشاشة | المسار | الملف | النوع | العناصر الأساسية | العمليات | الخدمات/العلاقات |
|---|---|---|---|---|---|---|
| لوحة الإدارة | `/admin` | `AdminDashboard.tsx` | private admin dashboard | KPI cards، charts | الانتقال لإدارة المستخدمين/المواد/النشاط/القضايا | directory users + subjects + assignments + submissions |
| إدارة المستخدمين | `/admin/users` | `AdminUsers.tsx` | private admin CRUD | add/edit dialog، role filters، search، stats cards، academic scope selectors | create/update/delete users | `admin-user-api`, `profiles/auth`, subject mappings |
| الأدوار والصلاحيات | `/admin/roles` | `AdminRoles.tsx` | private admin descriptive | KPI cards، users table، capability matrix | فلترة العرض فقط | `directoryUsers`, `role-capabilities.ts` |
| المواد والهيكل | `/admin/subjects` | `AdminSubjects.tsx` | private admin CRUD | form at top، stats cards، search، table، archive/delete | create/update/archive/delete subject | `subjects`, assignment dependency checks |
| سجل النشاطات | `/admin/activity` | `AdminActivity.tsx` | private admin reporting | KPI cards، filters، search، activity table | تصفية النشاط وفتح المسارات ذات الصلة | `activity_logs` أو feed مشتق |
| قضايا الأصالة | `/admin/reports` | `AdminReports.tsx` | private admin reporting | export، filter chips، case cards، table | مراقبة النظام وفتح الحالات | submissions + originality + matches |
| إعدادات النظام | `/admin/settings` | `AdminSettings.tsx` | private admin config | institution info، upload policy، analysis settings، originality thresholds، save/reset، latest changes | تحديث إعدادات النظام | `system_settings` |

## عناصر shell المشتركة
### `AppLayout.tsx`
- breadcrumbs
- role-aware page shell
- contextual labels for assignment/submission query params

### `AppSidebar.tsx`
- role navigation
- badge counts
- account links

### `TopBar.tsx`
- back button
- global search overlay
- theme toggle
- notifications
- role quick action

## عناصر واجهة متكررة مهمة
### النماذج
- login / forgot / change password
- admin users modal
- admin subject form
- admin settings form
- teacher create assignment form
- teacher review decision form
- student upload form

### الأزرار المهمة
- تسجيل الدخول
- إرسال reset password
- حفظ/نشر التكليف
- رفع التسليم
- بدء التحليل
- حفظ قرار المعلم
- إنشاء/تعديل/حذف المستخدم
- إنشاء/تعديل/أرشفة/حذف المادة
- حفظ إعدادات النظام

### الجداول
- التكليفات
- التسليمات
- التاريخ/السجل
- المستخدمون
- المواد
- تقارير القضايا
- سجل النشاط

### المودالات/Dialogs
- إضافة/تعديل مستخدم
- تأكيد حذف مستخدم
- تأكيد حذف/أرشفة مادة

## حالات التحميل والخطأ
### حالات تحميل مؤكدة
- pending session في `ProtectedRoute`
- `isLoading` في `AuthContext`
- تحميلات صفحات تعتمد على `AcademicDataContext`
- refreshing states في status/submissions pages

### حالات خطأ مؤكدة
- رسائل login failure
- reset password errors
- upload validation errors
- analysis start failure toasts
- save/review/save settings CRUD toasts

## الرسائل الظاهرة للمستخدم
**مؤكد بدرجة عالية من الصفحات:** النظام يستخدم toasts ورسائل inline لحالات:

- نجاح العملية
- فشل العملية
- عدم وجود بيانات
- ضرورة تحديث كلمة المرور
- انتظار التحليل
- تحويل إلى مراجعة يدوية

## تدفق التنقل بين الواجهات
### الطالب
`Dashboard -> Subjects/Assignments -> Upload -> Status -> Originality/Grades -> History/Calendar`

### المعلم
`Dashboard -> Create Assignment -> Assignments -> Submissions -> Review -> Reports/Analytics`

### الإدارة
`Dashboard -> Users / Subjects / Activity / Reports / Settings`

## ملاحظات
### مؤكد
- كل البوابات تستخدم shell موحد مع breadcrumbs وsidebar وtopbar.
- الشاشات الأساسية مترابطة بروابط مباشرة بين العمليات، وليست معزولة.

### غير مؤكد
- بعض حالات التحميل قد تكون ضمنية داخل components أو conditional rendering وليست ممثلة دائمًا بمكونات skeleton صريحة.
