# MASTER_SUMMARY

## ملخص شامل للنظام
هذا المستودع يحتوي على نظام ويب أكاديمي عربي متعدد البوابات لإدارة التكليفات، التسليمات، مراجعات المعلم، وتحليل الأصالة، مع وجود بوابة إدارة عليا لإدارة المستخدمين والمواد والإعدادات. البنية العامة مؤلفة من:

- واجهة React SPA
- طبقة تشغيل بيانات مركزية في `src/lib/supabase-app.ts`
- إدارة جلسات وأدوار في `src/contexts/AuthContext.tsx`
- إدارة بيانات أكاديمية حسب الدور في `src/contexts/AcademicDataContext.tsx`
- Supabase كطبقة backend-as-a-service
- Gemini داخل Edge Function لتحليل الأصالة الداخلي

## خارطة ملفات التوثيق
هذا الملف هو نقطة الدخول العامة. لبقية التفاصيل المتخصصة:

- البنية التقنية: [TECH_STACK.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/TECH_STACK.md)
- بنية المشروع والملفات: [PROJECT_STRUCTURE.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/PROJECT_STRUCTURE.md)
- خريطة الواجهات: [UI_MAP.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/UI_MAP.md)
- خريطة العمليات: [PROCESS_MAP.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/PROCESS_MAP.md)
- تحليل Supabase: [SUPABASE_ANALYSIS.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/SUPABASE_ANALYSIS.md)
- تحليل الذكاء الاصطناعي: [AI_INTEGRATION_ANALYSIS.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/AI_INTEGRATION_ANALYSIS.md)
- التكاملات الخارجية: [PLATFORM_INTEGRATION.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/PLATFORM_INTEGRATION.md)
- خريطة الـ APIs: [API_MAP.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/API_MAP.md)
- نموذج البيانات: [DATA_MODEL.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/DATA_MODEL.md)
- المصادقة والصلاحيات: [AUTH_AND_PERMISSIONS.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/AUTH_AND_PERMISSIONS.md)
- أهم الملفات: [IMPORTANT_FILES.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/IMPORTANT_FILES.md)
- تدفقات المستخدم: [USER_FLOWS.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/USER_FLOWS.md)
- التشغيل والإعداد: [SETUP_AND_RUN.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/SETUP_AND_RUN.md)
- الفجوات ونقاط الغموض: [UNKNOWNS_AND_GAPS.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs-system-analysis/UNKNOWNS_AND_GAPS.md)

## ما هو النظام وما هدفه
**مؤكد من الكود:** الهدف الأساسي هو إدارة دورة حياة التكليف الأكاديمي:

1. الأدمن ينشئ المستخدمين والمواد ويضبط الإعدادات.
2. المعلم ينشئ التكليفات المرتبطة بمواد محددة.
3. الطالب يرى فقط التكليفات المسموح له بها ويرفع الملفات.
4. النظام ينفذ تحليل أصالة داخلي على التسليم.
5. المعلم يراجع، يقرر، ويسجل الدرجة.
6. الطالب يرى الحالة والنتيجة والتقييم.

المراجع الأساسية:

- `package.json`
- `src/App.tsx`
- `src/contexts/AuthContext.tsx`
- `src/contexts/AcademicDataContext.tsx`
- `src/lib/supabase-app.ts`
- `supabase/functions/analyze-submission/index.ts`
- `supabase/migrations/*.sql`

## المستخدمون المحتملون
**مؤكد من `src/lib/auth.ts` و`src/components/AuthRoutes.tsx`:**

- `student`
- `teacher`
- `admin`

كل دور يملك مسارات وصفحات مخصصة داخل `src/App.tsx`.

## الوحدات الرئيسية
### 1. المصادقة والجلسات
- `src/contexts/AuthContext.tsx`
- `src/lib/auth.ts`
- `src/integrations/supabase/client.ts`

### 2. طبقة البيانات الأكاديمية
- `src/contexts/AcademicDataContext.tsx`
- `src/lib/academic-data.ts`
- `src/lib/supabase-app.ts`

### 3. بوابة الطالب
- `src/pages/student/*`

### 4. بوابة المعلم
- `src/pages/teacher/*`

### 5. بوابة الإدارة
- `src/pages/admin/*`

### 6. الإشعارات والتفضيلات
- `src/hooks/use-notifications.ts`
- `src/contexts/NotificationsContext.tsx`
- `src/lib/user-preferences.ts`

### 7. Supabase
- Auth
- Database
- Storage
- Edge Functions
- RPC
- Policies / RLS
- Migrations

### 8. الذكاء الاصطناعي
- `supabase/functions/analyze-submission/index.ts`

## التقنيات الأساسية المستخدمة
**مؤكد من `package.json` وملفات الإعداد:**

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui + Radix UI
- React Router DOM
- Supabase JS SDK
- Recharts
- Sonner
- Framer Motion
- Deno Edge Functions
- Google Gemini REST API

## الواجهات الرئيسية
**مؤكد من `src/App.tsx`:**

- صفحات عامة: `/`, `/login`, `/forgot-password`
- صفحات مشتركة: `/change-password`, `/notifications`, `/profile`, `/settings`
- صفحات الطالب: `/student/*`
- صفحات المعلم: `/teacher/*`
- صفحات الإدارة: `/admin/*`

## العمليات الرئيسية
**مؤكد بدرجة عالية من تتبع الصفحات + السياقات + الخدمات:**

- تسجيل الدخول
- تسجيل الخروج
- استعادة كلمة المرور
- تغيير كلمة المرور
- تحميل البيانات الأكاديمية حسب الدور
- إدارة المستخدمين
- إدارة المواد
- ربط الطالب والمعلم بالمواد
- إنشاء تكليف كمسودة أو منشور
- رفع ملف تسليم
- بدء تحليل الأصالة تلقائيًا أو يدويًا
- مراجعة التسليم وإسناد القرار والدرجة
- عرض التقارير والتحليلات
- حفظ قراءة الإشعارات
- تحديث إعدادات النظام

## كيف يرتبط Supabase بالنظام
**مؤكد من `src/lib/supabase-app.ts` و`src/contexts/AuthContext.tsx`:**

- الواجهة تستخدم `supabase-js` مباشرة.
- البيانات الأكاديمية والملفات الشخصية تحفظ في Supabase Database.
- الملفات ترفع إلى Buckets:
  - `assignment-attachments`
  - `student-submissions`
- العمليات الحساسة تمر أحيانًا عبر Edge Functions:
  - `admin-create-user`
  - `admin-update-user`
  - `admin-delete-user`
  - `admin-delete-subject`
  - `analyze-submission`
- توجد RPCs للوصول الآمن لبعض البيانات الحساسة:
  - `resolve_login_identifier`
  - `get_accessible_originality_checks`
  - `get_accessible_reviews`

## كيف يرتبط الذكاء الاصطناعي بالنظام
**مؤكد من `supabase/functions/analyze-submission/index.ts`:**

- الذكاء الاصطناعي لا يستدعى من المتصفح مباشرة.
- يبدأ من تسليم موجود في قاعدة البيانات.
- Function تقرأ الملف من Storage وتستخرج النص.
- تبني مرشحين للمقارنة من تسليمات داخلية في نفس النظام.
- ترسل النص + المرشحين إلى Gemini.
- تحفظ النتائج في:
  - `originality_checks`
  - `submission_matches`
  - `submissions`

**مؤكد:** الفحص الحالي هو **فحص تشابه/أصالة داخلي**، وليس كاشفًا عامًا للنصوص المولدة بالذكاء الاصطناعي إذا لم يوجد تطابق داخلي.

## كيف تتحرك البيانات داخل النظام
### من الواجهة إلى قاعدة البيانات
مثال `LoginPage`:

1. المستخدم يكتب البريد أو الرقم الأكاديمي أو رقم الموظف.
2. `AuthContext.signIn` يستدعي `signInWithSupabaseIdentifier`.
3. يتم استدعاء RPC `resolve_login_identifier`.
4. ثم `supabase.auth.signInWithPassword`.
5. بعدها يجلب النظام `profiles`.

مثال `StudentUpload`:

1. الطالب يختار تكليفًا وملفًا.
2. يتم التحقق من الامتداد والحجم.
3. يرفع الملف إلى `student-submissions`.
4. يتم `upsert` لسجل `submissions`.
5. قد يبدأ التحليل تلقائيًا حسب `system_settings`.

مثال `TeacherReview`:

1. المعلم يفتح تسليمًا محددًا.
2. يقرأ النتيجة والتحليل والمقاطع المشبوهة.
3. يحفظ القرار والدرجة والتعليقات.
4. تحدث `reviews` و`submissions`.

## أهم الملاحظات والمخاطر ونقاط الغموض
### مؤكد
- صفحة `AdminRoles` ليست RBAC editor حيًا؛ هي صفحة عرض/رقابة/مصفوفة وصفية.
- تفضيلات الواجهة والتنبيهات في `SettingsPage` تحفظ محليًا لكل مستخدم، وليست كلها في قاعدة البيانات.
- `QueryClientProvider` موجود، لكن التدفق التشغيلي للبيانات يعتمد أساسًا على React Context.
- هناك نمطان للعمل:
  - `local mode`
  - `supabase mode`

### مستنتج بدرجة عالية
- لا يوجد backend تقليدي منفصل؛ الواجهة تتحدث مباشرة مع Supabase وEdge Functions.
- Realtime غير مستخدم فعليًا كآلية أساسية؛ التطبيق يعتمد على polling وrefresh عند التركيز.

### غير مؤكد
- لا يمكن الجزم من الكود وحده بأن كل migrations مطبقة في كل بيئة منشورة.
- لا يمكن الجزم بوجود مراقبة خارجية أو observability production خارج قاعدة البيانات نفسها.

## ملخص نهائي مترابط
الصورة الكاملة للنظام كما تظهر من الكود:

- `App.tsx` يحدد البوابات والمسارات والحماية.
- `AuthContext` يدير الجلسات والهوية والدور.
- `AcademicDataContext` يعيد تشكيل البيانات حسب الطالب أو المعلم أو الأدمن.
- `supabase-app.ts` هو طبقة الوصول المحورية إلى Supabase.
- Supabase يدير الهوية والبيانات والملفات والـ Functions.
- Gemini يستخدم فقط داخل Function تحليل الأصالة.

النتيجة: النظام **مترابط تشغيليًا**، قائم على واجهة واحدة React، ويعتمد على Supabase كخلفية تشغيلية كاملة، مع ذكاء اصطناعي مدمج لتحليل الأصالة الداخلية ضمن تدفق أكاديمي واضح.
