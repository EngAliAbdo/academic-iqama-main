# API_MAP

## مقدمة
هذا الملف يحصر الواجهات البرمجية المستدعاة من التطبيق كما تظهر من الكود الفعلي.  
يشمل:

- Supabase Auth calls
- Supabase table operations
- Supabase RPC
- Supabase Edge Functions
- Google Gemini endpoint داخل Function

## 1. Supabase Auth API Calls
### 1.1 الحصول على الجلسة الحالية
- **الملف:** `src/contexts/AuthContext.tsx`, `src/lib/admin-user-api.ts`, `src/lib/supabase-app.ts`
- **الاستدعاء:** `supabase.auth.getSession()`
- **الطريقة:** SDK call
- **المدخلات:** لا شيء
- **المخرجات:** session أو null
- **يعتمد عليه:** حماية المسارات، استدعاء Functions، بناء المستخدم الحالي

### 1.2 مراقبة تغير الجلسة
- **الملف:** `src/contexts/AuthContext.tsx`
- **الاستدعاء:** `supabase.auth.onAuthStateChange(...)`
- **الطريقة:** subscription-like SDK call
- **المدخلات:** callback
- **المخرجات:** auth event + session

### 1.3 تسجيل الدخول
- **الملف:** `src/lib/supabase-app.ts`
- **الاستدعاء النهائي:** `supabase.auth.signInWithPassword`
- **المدخلات:** `email`, `password`
- **يعتمد عليه:** `useAuth().signIn`
- **ملاحظة:** يسبق هذا الاستدعاء RPC لحل `identifier`

### 1.4 استعادة كلمة المرور
- **الملف:** `src/pages/ForgotPasswordPage.tsx`
- **الاستدعاء:** `supabase.auth.resetPasswordForEmail`
- **المدخلات:** email

### 1.5 تغيير كلمة المرور
- **الملف:** `src/contexts/AuthContext.tsx`
- **الاستدعاء:** `supabase.auth.updateUser`
- **المدخلات:** `password`

## 2. RPC Calls
### 2.1 `resolve_login_identifier`
- **الملفات:** `src/lib/supabase-app.ts`, `src/pages/ForgotPasswordPage.tsx`
- **الاستدعاء:** `supabase.rpc("resolve_login_identifier", { lookup_identifier })`
- **الغرض:** تحويل البريد/الرقم الأكاديمي/رقم الموظف إلى email فعلي للمصادقة
- **المدخلات:** `lookup_identifier`
- **المخرجات:** email resolved أو null
- **يعتمد عليه:** تسجيل الدخول، reset password

### 2.2 `get_accessible_originality_checks`
- **الملفات:** `src/lib/supabase-app.ts`
- **الغرض:** إرجاع نتائج الأصالة المسموح للمستخدم الحالي برؤيتها مع masking حسب الدور

### 2.3 `get_accessible_reviews`
- **الملفات:** `src/lib/supabase-app.ts`
- **الغرض:** إرجاع المراجعات المسموح للمستخدم الحالي برؤيتها

## 3. Edge Function Endpoints
### 3.1 `POST /functions/v1/admin-create-user`
- **الملف المستدعي:** `src/lib/admin-user-api.ts`
- **الملف المنفذ:** `supabase/functions/admin-create-user/index.ts`
- **المصادقة:** Bearer access token + `apikey`
- **المدخلات:** email, password, role, full_name, identifier, department, role_title, level, semester, force_password_change
- **المخرجات:** `user`
- **يعتمد عليه:** إنشاء المستخدم من شاشة الأدمن

### 3.2 `POST /functions/v1/admin-update-user`
- **الملف المستدعي:** `src/lib/admin-user-api.ts`
- **الملف المنفذ:** `supabase/functions/admin-update-user/index.ts`
- **المدخلات:** `user_id` + بيانات التعديل
- **المخرجات:** `user`

### 3.3 `POST /functions/v1/admin-delete-user`
- **الملف المستدعي:** `src/lib/admin-user-api.ts`
- **الملف المنفذ:** `supabase/functions/admin-delete-user/index.ts`
- **المدخلات:** `user_id`
- **المخرجات:** `deleted_user`, `impact_summary`

### 3.4 `POST /functions/v1/admin-delete-subject`
- **الملف المستدعي:** `src/lib/supabase-app.ts`
- **الملف المنفذ:** `supabase/functions/admin-delete-subject/index.ts`
- **المدخلات:** `subject_id`
- **المخرجات:** success or error

### 3.5 `POST /functions/v1/analyze-submission`
- **الملفات المستدعية:** `src/lib/supabase-app.ts`
- **الملف المنفذ:** `supabase/functions/analyze-submission/index.ts`
- **المدخلات:** `submissionId`
- **المخرجات:** status/result metadata
- **يعتمد عليه:** بدء التحليل أو إعادة التحليل

## 4. Supabase Table Operations
### 4.1 `profiles`
- **القراءة:** session profile, accessible profiles, admin user lists
- **الكتابة:** داخل Functions الإدارية، وتحديث flags مثل `must_change_password`

### 4.2 `subjects`
- **القراءة:** تحميل دليل المواد
- **الكتابة:** create/update مباشرة من `supabase-app.ts`
- **الحذف:** عبر `admin-delete-subject`

### 4.3 `teacher_subjects`
- **القراءة:** تحميل مواد المعلمين
- **الكتابة:** ensure/remove mappings من `supabase-app.ts`

### 4.4 `student_subjects`
- **القراءة:** تحميل تسجيلات الطلاب
- **الكتابة:** ensure/remove mappings من `supabase-app.ts`

### 4.5 `assignments`
- **القراءة:** عبر `loadSupabaseAcademicData`
- **الكتابة:** `createSupabaseAssignment`
- **التحديث:** status/archive/delete paths

### 4.6 `submissions`
- **القراءة:** للطالب والمعلم والإدارة حسب الدور
- **الكتابة:** `upsertSupabaseSubmission`
- **التحديث:** analysis status, review decision, grade

### 4.7 `reviews`
- **القراءة:** عبر RPC/joins
- **الكتابة:** `updateSupabaseSubmissionReview`

### 4.8 `originality_checks`
- **القراءة:** عبر RPC
- **الكتابة:** داخل `analyze-submission`

### 4.9 `submission_matches`
- **القراءة:** ضمن نتائج التحليل
- **الكتابة:** داخل `analyze-submission`

### 4.10 `system_settings`
- **القراءة:** `loadSupabaseSystemSettings`
- **الكتابة:** `updateSupabaseSystemSettings`

### 4.11 `notification_reads`
- **القراءة:** `loadSupabaseNotificationReadIds`
- **الكتابة:** `upsertSupabaseNotificationReadIds`

### 4.12 `activity_logs`
- **القراءة:** `loadSupabaseAcademicData`
- **الكتابة:** triggers database-side

## 5. Supabase Storage Operations
### 5.1 رفع مرفقات التكليف
- **الملف:** `src/lib/supabase-app.ts`
- **الدوال:** `uploadSupabaseAssignmentAttachments`
- **الباكت:** `assignment-attachments`

### 5.2 حذف مرفقات التكليف
- **الدالة:** `removeSupabaseAssignmentAttachments`

### 5.3 توليد روابط تنزيل مرفقات التكليف
- **الدالة:** `createSupabaseAssignmentAttachmentSignedUrl`

### 5.4 رفع ملفات التسليم
- **الدالة:** `uploadSupabaseSubmissionFile`
- **الباكت:** `student-submissions`

### 5.5 توليد رابط تنزيل/معاينة التسليم
- **الدالة:** `createSupabaseSubmissionSignedUrl`

## 6. External HTTP APIs
### 6.1 Google Gemini REST API
- **الملف:** `supabase/functions/analyze-submission/index.ts`
- **الطريقة:** `POST`
- **المسار العام:** `https://generativelanguage.googleapis.com/.../models/${GEMINI_MODEL}:generateContent`
- **المصادقة:** `GEMINI_API_KEY`
- **المدخلات:** prompt + submission text + internal candidates
- **المخرجات:** generative response parsed إلى JSON

## 7. Error Handling
### في الواجهة
- استدعاءات `fetch` في `admin-user-api.ts` تقرأ النص الخام، ثم تحاول parse للخطأ، ثم تعيد error message واضحة
- `supabase-app.ts` يعيد `ok/error` patterns في عدة عمليات
- الشاشات تعرض toast أو رسائل inline

### في Functions
- ترجع `Response.json({ error: ... }, { status: ... })`
- تتحقق من auth token والدور داخليًا

### في تحليل AI
- تحويل بعض الحالات إلى:
  - `failed`
  - `manual_review_required`

## 8. Retries / Interceptors / Middleware
### مؤكد
- لا يوجد axios interceptor layer أو middleware HTTP عام
- لا توجد retry wrappers موحدة على مستوى الواجهة

### مستنتج بدرجة عالية
- التطبيق يعتمد على:
  - SDK direct calls
  - `fetch`
  - polling في بعض الصفحات بدل بنية networking layer معقدة

## 9. ما العمليات التي يعتمد عليها كل Endpoint
| Endpoint / Call | العمليات المعتمدة عليه |
|---|---|
| `resolve_login_identifier` | login, forgot password |
| `signInWithPassword` | login |
| `resetPasswordForEmail` | forgot password |
| `updateUser` | change password |
| `admin-create-user` | admin create user |
| `admin-update-user` | admin update user |
| `admin-delete-user` | admin delete user |
| `admin-delete-subject` | admin delete subject |
| `analyze-submission` | auto/manual originality analysis |
| `get_accessible_originality_checks` | student/teacher/admin originality display |
| `get_accessible_reviews` | student/teacher/admin review display |
| storage upload/download | assignment attachments, student submissions |

## خلاصة
طبقة الـ API في هذا المشروع ليست REST backend تقليدية، بل مزيج من:

- Supabase Auth SDK
- Supabase table queries
- Supabase RPC
- Supabase Storage
- Supabase Edge Functions
- Gemini REST داخل Function

وهذا يعني أن `src/lib/supabase-app.ts` و`src/lib/admin-user-api.ts` هما الملفان الأكثر محورية لفهم خريطة الـ API الفعلية.
