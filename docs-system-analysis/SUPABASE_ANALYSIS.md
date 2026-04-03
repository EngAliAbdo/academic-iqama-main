# SUPABASE_ANALYSIS

## نظرة عامة
**مؤكد من الكود:** النظام يستخدم Supabase كطبقة backend-as-a-service رئيسية، ويعتمد عليه في:

- المصادقة `Auth`
- قاعدة البيانات `Postgres`
- التخزين `Storage`
- Edge Functions
- RPC Functions
- RLS / Policies
- Migrations

الملفات المرجعية الأساسية:

- `src/integrations/supabase/client.ts`
- `src/lib/supabase-app.ts`
- `src/contexts/AuthContext.tsx`
- `src/contexts/AcademicDataContext.tsx`
- `supabase/config.toml`
- `supabase/migrations/*.sql`
- `supabase/functions/*`

## إنشاء Supabase Client
**مؤكد من الكود:** العميل الأمامي يُنشأ في:

- `src/integrations/supabase/client.ts`

ويستخدم:

- `createClient<Database>(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, ...)`

هذا هو العميل الرئيسي المستخدم في الواجهة الأمامية.

## المتغيرات البيئية المستخدمة
### الواجهة الأمامية
**مؤكد من `.env.example` و`.env.local.example`:**

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_ALLOW_LOCAL_DEMO_FALLBACK`

### Edge Functions
**مؤكد من `supabase/.env.example` ومن ملفات Functions:**

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## كيف يرتبط Supabase بالتطبيق
### 1. المصادقة
**مؤكد من `src/contexts/AuthContext.tsx` و`src/lib/supabase-app.ts`:**

- الواجهة تستخدم `supabase.auth.getSession()`
- تتابع تغير الجلسة عبر `supabase.auth.onAuthStateChange(...)`
- تسجيل الدخول يتم عبر:
  1. RPC `resolve_login_identifier`
  2. ثم `supabase.auth.signInWithPassword`
- استعادة كلمة المرور تتم عبر `supabase.auth.resetPasswordForEmail`
- تغيير كلمة المرور يتم عبر `supabase.auth.updateUser`

### 2. قاعدة البيانات
**مؤكد من `src/lib/supabase-app.ts`:**

عمليات القراءة والكتابة الأساسية تتم مباشرة من الواجهة إلى Supabase Tables/RPCs، وأهمها:

- `profiles`
- `subjects`
- `teacher_subjects`
- `student_subjects`
- `assignments`
- `submissions`
- `reviews`
- `originality_checks`
- `submission_matches`
- `activity_logs`
- `system_settings`
- `notification_reads`

### 3. التخزين
**مؤكد من `src/lib/supabase-app.ts` والمigrations:**

Buckets المستخدمة:

- `assignment-attachments`
- `student-submissions`

الاستخدامات:

- رفع مرفقات التكليفات
- رفع ملفات تسليمات الطلاب
- توليد signed URLs للتنزيل أو المعاينة

### 4. Edge Functions
**مؤكد من `src/lib/admin-user-api.ts` و`src/lib/supabase-app.ts` و`supabase/functions/*`:**

Functions المكتشفة:

- `admin-create-user`
- `admin-update-user`
- `admin-delete-user`
- `admin-delete-subject`
- `analyze-submission`

### 5. RPC
**مؤكد من `src/lib/supabase-app.ts` و`src/integrations/supabase/types.ts`:**

RPCs المكتشفة:

- `resolve_login_identifier`
- `get_accessible_originality_checks`
- `get_accessible_reviews`

### 6. Realtime
**غير مؤكد كمكوّن مستخدم فعليًا.**

لم يظهر استخدام صريح لقنوات Realtime داخل الواجهة. الموجود فعليًا هو:

- polling دوري
- refresh عند التركيز أو الرجوع للتبويب

إذن:

- Supabase Realtime: **غير مؤكد أنه مستخدم**
- polling: **مؤكد أنه مستخدم**

## أماكن استخدام Supabase في الكود
### العميل
- `src/integrations/supabase/client.ts`

### المصادقة
- `src/contexts/AuthContext.tsx`
- `src/lib/supabase-app.ts`
- `src/pages/ForgotPasswordPage.tsx`
- `src/pages/ChangePasswordPage.tsx`

### خدمات قاعدة البيانات والتخزين
- `src/lib/supabase-app.ts`
- `src/contexts/AcademicDataContext.tsx`
- `src/lib/admin-user-api.ts`

### الوظائف السحابية
- `src/lib/admin-user-api.ts`
- `src/lib/supabase-app.ts`

### الأنواع
- `src/integrations/supabase/types.ts`

### التهيئة والعمليات المحلية
- `scripts/check-supabase-setup.mjs`
- `scripts/init-supabase-env.mjs`
- `scripts/build-supabase-sql-bundle.mjs`
- `scripts/live-*.mjs`

## الجداول والكيانات المستنتجة
**مؤكد من المايغريشنات والأنواع:**

| الكيان | الدور |
|---|---|
| `profiles` | ملف المستخدم الموحد للأدوار |
| `subjects` | دليل المواد الأكاديمية |
| `teacher_subjects` | ربط المعلمين بالمواد |
| `student_subjects` | ربط الطلاب بالمواد |
| `assignments` | التكليفات |
| `submissions` | تسليمات الطلاب |
| `reviews` | قرارات وملاحظات المعلمين |
| `originality_checks` | نتائج فحص الأصالة |
| `submission_matches` | التطابقات الداخلية والمقاطع المشبوهة |
| `activity_logs` | سجل النشاطات |
| `system_settings` | إعدادات النظام العامة |
| `notification_reads` | حالة قراءة الإشعارات |
| `teacher_departments` | نطاقات/جهات مرتبطة بالمعلم |

## العمليات الرئيسية على البيانات
### عمليات قراءة
- تحميل الجلسة والملف الشخصي
- تحميل بيانات الطالب/المعلم/الأدمن
- تحميل المواد والتكليفات والتسليمات
- تحميل الإعدادات
- تحميل نتائج الأصالة والمراجعات
- تحميل سجل النشاطات

### عمليات كتابة
- إنشاء/تعديل/حذف المستخدم
- إنشاء/تعديل/أرشفة/حذف المادة
- إنشاء التكليف
- رفع التسليم
- تحديث المراجعة والدرجة
- بدء التحليل أو إعادة التحليل
- تحديث إعدادات النظام
- حفظ قراءة الإشعار

## تدفق المصادقة
**مؤكد من `AuthContext.tsx`:**

1. التطبيق يتحقق من وجود session من Supabase.
2. إذا وجدت session:
   - يجلب `profiles` للمستخدم الحالي
   - يبني `AuthContext.user`
3. `ProtectedRoute` يطبق:
   - شرط تسجيل الدخول
   - شرط الدور
   - شرط `must_change_password`

## إدارة الجلسات
**مؤكد:**

- في وضع Supabase: الجلسة تأتي من `supabase.auth`
- في وضع local: الجلسة تأتي من `localStorage`
- يوجد دعم اختياري لـ local fallback عبر:
  - `VITE_ALLOW_LOCAL_DEMO_FALLBACK`

## الحماية والصلاحيات
### في الواجهة
**مؤكد من `AuthRoutes.tsx`:**

- حماية المسارات حسب الدور
- منع دخول الصفحات الخاصة قبل المصادقة
- إجبار المستخدم على `/change-password` عند الحاجة

### في قاعدة البيانات
**مؤكد من المايغريشنات:**

- تفعيل RLS على أغلب الجداول الحساسة
- سياسات select/insert/update/delete حسب:
  - `auth.uid()`
  - الدور
  - وظائف مساعدة مثل:
    - `current_user_role`
    - `is_admin`
    - `is_teacher_for_assignment`
    - `is_submission_owner`
    - `can_manage_submission`
    - `can_student_access_assignment`

### في Edge Functions
**مؤكد من Functions:**

- gateway يستخدم `verify_jwt = false`
- لكن كل Function تتحقق داخليًا من:
  - Bearer token
  - المستخدم الحالي
  - ملفه في `profiles`
  - دوره

## افتراضات أمنية محتملة
### مؤكد
- الاعتماد على RLS جزء أساسي من الحماية
- بعض البيانات الحساسة تعرض عبر RPCs مفلترة بدل القراءة المباشرة
- Functions الإدارية تستخدم service role داخليًا

### مستنتج بدرجة عالية
- أي خلل في RLS أو في ربط الملف الشخصي بالدور قد ينعكس مباشرة على الوصول
- وجود dual mode (`local` و`supabase`) يزيد تعقيد الفهم والاختبار

### غير مؤكد
- لا يمكن الجزم من الكود وحده أن كل البيئات المنشورة مطابقة بالكامل لآخر migrations
- لا يمكن الجزم بوجود monitoring أمني خارجي أو auditing production خارج `activity_logs`

## نقاط الغموض
- `Supabase Realtime`: غير مؤكد أنه مستخدم فعليًا
- لا يوجد دليل من الكود فقط على طريقة إدارة أسرار production أو دورات تدويرها
- لا يوجد دليل من الكود فقط على وجود backup/restore policy خارج Supabase managed service

## خلاصة
**الحكم التقني:** Supabase هو العمود الفقري الخلفي للنظام.  
الواجهة لا تستخدم backend مخصصًا منفصلًا؛ بل تعتمد مباشرة على:

- `supabase-js`
- RLS
- RPCs
- Storage
- Edge Functions

وهذا يجعل `src/lib/supabase-app.ts` + المايغريشنات + Functions هي الطبقة الأكثر محورية لفهم النظام كله.
