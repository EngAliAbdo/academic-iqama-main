# PROCESS_MAP

## مقدمة
هذا الملف يلخص العمليات التشغيلية الأساسية End-to-End كما تظهر من تتبع:

- الصفحات في `src/pages/*`
- السياقات في `src/contexts/*`
- طبقة Supabase في `src/lib/supabase-app.ts`
- المايغريشنز وEdge Functions

---

## 1. تسجيل الدخول
- **الوصف:** فتح جلسة مستخدم بالاعتماد على البريد أو الرقم الأكاديمي أو رقم الموظف.
- **نقطة البداية:** `/login`
- **الملف البادئ:** `src/pages/LoginPage.tsx`
- **handler:** `handleLogin`
- **الدوال/السياقات:** `useAuth().signIn`, `signInWithSupabaseIdentifier`
- **الطلبات الشبكية:** RPC `resolve_login_identifier`, ثم `supabase.auth.signInWithPassword`
- **البيانات المتأثرة:** الجلسة فقط + قراءة `profiles`
- **المدخلات:** `identifier`, `password`
- **التحقق:** التحقق من تعبئة الحقول، ثم التحقق من بيانات الاعتماد من Supabase
- **الصلاحيات المطلوبة:** لا شيء
- **النتيجة:** جلسة جديدة + redirect حسب الدور
- **الأخطاء المحتملة:** بيانات دخول غير صحيحة / حساب غير موجود / فشل شبكة
- **رسائل المستخدم:** رسائل خطأ login toast أو inline
- **الحالة:** مؤكد

## 2. استعادة كلمة المرور
- **الوصف:** طلب reset password عبر Supabase email flow.
- **نقطة البداية:** `/forgot-password`
- **الملف:** `src/pages/ForgotPasswordPage.tsx`
- **handler:** `handleSubmit`
- **الدوال:** `supabase.auth.resetPasswordForEmail`
- **الطلبات:** RPC `resolve_login_identifier`, ثم Auth reset
- **البيانات المتأثرة:** لا تغيير مباشر في الجداول من الواجهة
- **المدخلات:** identifier
- **التحقق:** matching identifier -> email
- **الصلاحيات:** عامة
- **النتيجة:** إرسال رسالة reset
- **الأخطاء:** identifier غير صالح / Supabase auth error
- **الحالة:** مؤكد

## 3. تغيير كلمة المرور الإجباري
- **الوصف:** المستخدم الذي عليه `must_change_password` يمر عبر `/change-password`.
- **نقطة البداية:** Redirect من `ProtectedRoute`
- **الملف:** `src/pages/ChangePasswordPage.tsx`
- **handler:** `handleSubmit`
- **الدوال:** `useAuth().changePassword`, `supabase.auth.updateUser`, تحديث `profiles`
- **البيانات المتأثرة:** `auth.users`, `profiles.must_change_password`, `profiles.first_login`, `profiles.default_password_flag`
- **المدخلات:** كلمة المرور الجديدة + التأكيد
- **التحقق:** length + match
- **الصلاحيات:** مستخدم مسجل فقط
- **النتيجة:** تحديث كلمة المرور وإلغاء العلم
- **الحالة:** مؤكد

## 4. تحميل البيانات الأكاديمية الأساسية
- **الوصف:** عند تسجيل الدخول وتحميل shell، يتم جلب بيانات النظام حسب الدور.
- **نقطة البداية:** بعد وجود session
- **الملف البادئ:** `src/contexts/AcademicDataContext.tsx`
- **الدوال:** `loadSupabaseAcademicData`
- **الطلبات:** reads من `assignments`, `subjects`, `submissions`, `teacher_subjects`, `student_subjects`, `activity_logs`, RPCs للأصالة والمراجعات
- **البيانات المتأثرة:** state فقط
- **الصلاحيات:** تعتمد على RLS + RPC access control
- **النتيجة:** امتلاء state المركزي
- **الأخطاء:** فشل الاتصال أو RLS mismatch
- **الحالة:** مؤكد

## 5. إنشاء مستخدم جديد
- **الوصف:** الأدمن ينشئ مستخدمًا جديدًا في `auth.users` و`profiles`.
- **نقطة البداية:** `/admin/users`
- **الملف:** `src/pages/admin/AdminUsers.tsx`
- **handler:** `handleSaveUser`
- **الدوال:** `createAdminUser` من `src/lib/admin-user-api.ts`
- **الطلبات:** `fetch` إلى `/functions/v1/admin-create-user`
- **البيانات المتأثرة:** `auth.users`, `profiles`, وربما `teacher_departments`
- **المدخلات:** الاسم، البريد، الدور، المعرّف الأكاديمي/رقم الموظف، المسارات الأكاديمية، subjects
- **التحقق:** uniqueness, role-specific fields, subject selection
- **الصلاحيات:** admin فقط
- **النتيجة:** إنشاء المستخدم وتحديث العرض
- **الأخطاء:** تكرار المعرف/البريد/فشل function
- **الحالة:** مؤكد

## 6. تعديل أو حذف مستخدم
- **نقطة البداية:** `/admin/users`
- **handlers:** `handleSaveUser`, `handleDeleteUser`
- **الدوال:** `updateAdminUser`, `deleteAdminUser`
- **الطلبات:** `admin-update-user`, `admin-delete-user`
- **الجداول:** `profiles`, `teacher_departments`, counts في `assignments/submissions/reviews/...`, ثم `auth.users`
- **التحقق:** منع حذف آخر admin، منع حذف النفس، تحقق من consistency للدور
- **الصلاحيات:** admin فقط
- **النتيجة:** تعديل/حذف المستخدم
- **الحالة:** مؤكد

## 7. إنشاء أو تعديل أو أرشفة أو حذف مادة
- **نقطة البداية:** `/admin/subjects`
- **الملف:** `src/pages/admin/AdminSubjects.tsx`
- **handlers:** `handleSaveSubject`, `handleToggleSubjectStatus`, `handleDeleteSubject`
- **الدوال:** create/update subject عبر `AcademicDataContext`, delete via `deleteSupabaseSubject`
- **الطلبات:** `subjects` insert/update، و`admin-delete-subject` function للحذف
- **البيانات المتأثرة:** `subjects`
- **التحقق:** تماسك الاسم/الرمز/القسم/المستوى/الفصل
- **الصلاحيات:** admin فقط
- **النتيجة:** تحديث دليل المواد
- **الأخطاء:** subject in use / duplicate code / function failure
- **الحالة:** مؤكد

## 8. إنشاء تكليف
- **الوصف:** المعلم ينشئ تكليفًا كمسودة أو منشور.
- **نقطة البداية:** `/teacher/create-assignment`
- **الملف:** `src/pages/teacher/TeacherCreateAssignment.tsx`
- **الدوال:** `createAssignment`, `uploadSupabaseAssignmentAttachments`
- **handler المهم:** submit handler داخل الصفحة (يستدعي `createAssignment`)
- **الطلبات:** `assignments` insert + bucket `assignment-attachments`
- **البيانات المتأثرة:** `assignments`, Storage attachments, `activity_logs` عبر triggers
- **المدخلات:** title, subject, description, instructions, due date/time, formats, max submissions, resubmission policy, attachments, status
- **التحقق:** subject مرتبط بالمعلم، due date، formats مسموحة
- **الصلاحيات:** teacher أو admin سياقيًا
- **النتيجة:** تكليف جديد
- **الحالة:** مؤكد

## 9. حسم وصول الطالب للتكليف
- **الوصف:** تقرير ما إذا كان الطالب يرى التكليف أم لا.
- **نقطة البداية:** أثناء جلب/فلترة التكليفات للطالب
- **الملفات:** `src/lib/academic-data.ts`, `supabase/migrations/202603230004_assignment_scope_rls.sql`, `202603260003_student_subject_enrollments.sql`, `202603280001_remove_sections_and_word_protection.sql`
- **الدوال:** `canStudentAccessAssignmentWithMappings`, DB function `can_student_access_assignment`
- **البيانات:** `assignments`, `subjects`, `profiles`, `student_subjects`
- **المنطق:** 
  - إن وجد enrollment صريح للمادة -> الطالب يجب أن يكون مسجلاً بها
  - وإلا fallback إلى department/level/semester
- **الصلاحيات:** enforced in frontend logic + RLS
- **النتيجة:** التكليف يظهر أو لا يظهر
- **الحالة:** مؤكد

## 10. رفع ملف تسليم
- **نقطة البداية:** `/student/upload`
- **الملف:** `src/pages/student/StudentUpload.tsx`
- **handlers:** `handleChooseFile`, `handleSubmit`, `handleDownloadAttachment`
- **الدوال:** `submitAssignment`, `uploadSupabaseSubmissionFile`
- **الطلبات:** Storage upload to `student-submissions`, `submissions` upsert
- **البيانات المتأثرة:** `submissions`, storage bucket, وربما cleanup لآثار قديمة
- **المدخلات:** assignment, file, notes
- **التحقق:** extension, max size, allowed formats, assignment access
- **الصلاحيات:** الطالب صاحب الجلسة ولديه وصول للتكليف
- **النتيجة:** تسليم جديد أو إعادة تسليم
- **الأخطاء:** invalid file, upload failure, DB upsert failure
- **الحالة:** مؤكد

## 11. بدء تحليل الأصالة
- **الوصف:** تشغيل Edge Function لتحليل التسليم.
- **نقطة البداية:** تلقائيًا بعد الرفع أو يدويًا من صفحات المعلم
- **الملفات:** `StudentUpload.tsx`, `TeacherSubmissions.tsx`, `TeacherReview.tsx`, `AcademicDataContext.tsx`, `supabase-app.ts`
- **handlers:** زر `بدء التحليل` في المعلم، أو auto start في `submitAssignment`
- **الدوال:** `startSubmissionAnalysis`, `requestSupabaseSubmissionAnalysis`
- **الطلبات:** `supabase.functions.invoke("analyze-submission")`
- **الجداول المتأثرة:** `submissions`, `originality_checks`, `submission_matches`, `activity_logs`
- **المدخلات:** `submissionId`
- **الصلاحيات:** owner student / assignment teacher / admin
- **النتيجة:** حالة `processing/completed/failed/manual_review_required`
- **الأخطاء:** file missing, extraction failure, Gemini failure, parse failure
- **الحالة:** مؤكد

## 12. مراجعة المعلم وحفظ القرار
- **نقطة البداية:** `/teacher/review?submission=...`
- **الملف:** `src/pages/teacher/TeacherReview.tsx`
- **handlers:** `handleSave`, `handleDownloadSubmission`, `handleStartAnalysis`
- **الدوال:** `reviewSubmission`, `createSupabaseSubmissionSignedUrl`, `startSubmissionAnalysis`
- **الطلبات:** update/upsert on `reviews`, update `submissions`, storage signed URL
- **البيانات المتأثرة:** `reviews`, `submissions`, `activity_logs`
- **المدخلات:** final decision, grade, teacher comments
- **التحقق:** role, selected submission, decision state
- **الصلاحيات:** teacher owner أو admin
- **النتيجة:** قرار محفوظ يظهر للطالب
- **الحالة:** مؤكد

## 13. الإشعارات وقراءة الإشعار
- **الوصف:** توليد إشعارات مشتقة من البيانات + حفظ حالة القراءة.
- **نقطة البداية:** أي بوابة + `NotificationsPage`
- **الملفات:** `src/hooks/use-notifications.ts`, `src/contexts/NotificationsContext.tsx`, `src/pages/NotificationsPage.tsx`
- **الدوال:** `markAsRead`, `markAllAsRead`
- **الطلبات:** `notification_reads` select/upsert في Supabase mode
- **البيانات المتأثرة:** `notification_reads`
- **الصلاحيات:** المستخدم يقرأ/يكتب حالته الخاصة فقط
- **النتيجة:** unread count يتغير
- **الحالة:** مؤكد

## 14. تحديث إعدادات النظام
- **نقطة البداية:** `/admin/settings`
- **الملف:** `src/pages/admin/AdminSettings.tsx`
- **handlers:** `handleSave`, `handleReset`
- **الدوال:** `updateSystemSettings`
- **الطلبات:** update/select on `system_settings`
- **البيانات المتأثرة:** `system_settings`, وربما `activity_logs` عبر settings activity flow
- **المدخلات:** institutionName, academicYear, maxUploadSizeMb, allowedSubmissionFormats, thresholds, flags
- **الصلاحيات:** admin فقط
- **النتيجة:** إعدادات النظام تتحدث وتؤثر على upload/analysis
- **الحالة:** مؤكد

## 15. سجل النشاطات
- **الوصف:** تسجيل lifecycle events تلقائيًا.
- **نقطة البداية:** insert/update على assignments/submissions/originality_checks/reviews
- **الملفات:** `supabase/migrations/202603230005_activity_logs.sql`, `activity-feed.ts`, `AdminActivity.tsx`
- **الآلية:** triggers + function `record_activity_log`
- **الجداول المتأثرة:** `activity_logs`
- **النتيجة:** feed إداري قابل للقراءة والتصفية
- **الحالة:** مؤكد

## ملاحظات عامة
- بعض العمليات تعتمد على واجهة + منطق frontend + RLS معًا، وليست مجرد button -> API واحدة.
- في بعض الشاشات، الأخطاء النهائية للمستخدم تظهر عبر toast عامة ما لم يرجع backend نصًا أكثر تحديدًا.
- العمليات المرتبطة بالتحليل تعتمد على توفر Supabase Storage + Edge Function + Gemini بشكل مترابط.
