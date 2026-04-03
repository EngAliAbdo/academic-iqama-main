# AI_INTEGRATION_ANALYSIS

## نظرة عامة
**مؤكد من الكود:** التكامل مع الذكاء الاصطناعي موجود داخل النظام، لكنه **ليس عامًا** ولا يعمل كواجهة Chat.  
وظيفته الحالية محددة جدًا:

- تحليل أصالة/تشابه تسليمات الطلاب
- مقارنة التسليم الحالي مع تسليمات داخلية من نفس النظام
- استخدام Gemini لتفسير الأدلة، بناء ملخصات، وتصنيف مستوى الخطر

الملفات المرجعية الأساسية:

- `supabase/functions/analyze-submission/index.ts`
- `supabase/functions/analyze-submission/README.md`
- `src/lib/supabase-app.ts`
- `src/contexts/AcademicDataContext.tsx`
- `src/pages/student/StudentOriginality.tsx`
- `src/pages/teacher/TeacherSubmissions.tsx`
- `src/pages/teacher/TeacherReview.tsx`
- `src/pages/teacher/TeacherReports.tsx`

## مزود الذكاء الاصطناعي
**مؤكد من الكود:** المزود المستخدم هو **Google Gemini** عبر REST API.

الدليل:

- `supabase/functions/analyze-submission/index.ts`
- متغيرات البيئة:
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`

## أين يبدأ التكامل مع الذكاء الاصطناعي
### من الواجهة
**مؤكد من الكود:**

- الطالب قد يفعّل التحليل ضمنيًا بعد الرفع إذا كانت الإعدادات تسمح بذلك
  - `src/pages/student/StudentUpload.tsx`
- المعلم يستطيع بدء التحليل أو إعادة التحليل يدويًا
  - `src/pages/teacher/TeacherSubmissions.tsx`
  - `src/pages/teacher/TeacherReview.tsx`

### من طبقة البيانات
- `src/contexts/AcademicDataContext.tsx`
- `src/lib/supabase-app.ts`

### نقطة التنفيذ الفعلي
- `supabase/functions/analyze-submission/index.ts`

## ما الوظيفة التي يؤديها الذكاء الاصطناعي
**مؤكد من الكود:** الوظيفة ليست Chat ولا Assistant.

الاستخدام الحالي هو:

- `Extraction support` بشكل غير مباشر بعد استخراج النص من الملف
- `Classification / analysis`
- `Structured interpretation`
- `Internal similarity/originality reasoning`

**ليس مؤكدًا ولا ظاهرًا في الكود:**

- Chat UI
- Assistants API
- Embeddings
- Vector search
- RAG
- Streaming chat
- Vision
- Audio
- Tool calling عام

## ما الذي يفحصه النظام فعليًا
**مؤكد من `analyze-submission/index.ts`:**

النظام الحالي يفحص:

1. تطابقات داخلية حرفية أو شبه حرفية بين التسليم الحالي وتسليمات أخرى في النظام
2. كثافة المقاطع المتشابهة
3. نمط التشابه وسياقه
4. درجة الثقة في التقييم

**مهم جدًا:**  
التحليل الحالي **ليس كاشفًا مستقلاً للنص المولد بالذكاء الاصطناعي** إذا لم توجد تطابقات داخلية أو مؤشرات مشتقة من المقارنة الداخلية.

بعبارة أدق:

- الفحص الحالي = **تشابه/أصالة داخلي**
- وليس = **AI-generated text detector** مستقل

## تدفق التحليل
### 1. تحديد التسليم
- يبدأ من `submissionId`

### 2. التحقق من الصلاحية
**مؤكد من الكود:** يسمح بالتحليل إذا كان الفاعل:

- الطالب صاحب التسليم
- المعلم صاحب التكليف
- الأدمن

### 3. تحميل الملف
- من bucket `student-submissions`

### 4. استخراج النص
**مؤكد من imports في Function:**

- PDF: باستخدام `pdfjs-dist`
- DOCX: باستخدام `mammoth`

### 5. بناء المرشحين للمقارنة
**مؤكد من الكود:** المرشحون الداخليون يأتون من 3 نطاقات:

- `same_assignment`
- `same_subject`
- `same_level_semester`

### 6. بناء الطلب إلى Gemini
الوظيفة ترسل:

- النص المستخرج من التسليم الحالي
- قائمة المرشحين الداخليين
- تعليمات منظمة لإرجاع تحليل JSON

### 7. استلام الاستجابة
الاستجابة تُحوَّل إلى:

- `originality_checks`
- `submission_matches`
- تحديث `submissions`

### 8. عرض النتيجة
### الطالب
- `src/pages/student/StudentOriginality.tsx`

### المعلم
- `src/pages/teacher/TeacherSubmissions.tsx`
- `src/pages/teacher/TeacherReview.tsx`
- `src/pages/teacher/TeacherReports.tsx`
- `src/pages/teacher/TeacherAnalytics.tsx`

## المودل المستخدم
**مؤكد من الكود والتوثيق:**

- القيمة الافتراضية: `gemini-2.5-flash`

لكنها قابلة للتغيير عبر:

- `GEMINI_MODEL`

## هل توجد prompts أو instructions داخلية
**مؤكد من الكود:** نعم، توجد تعليمات داخلية ضمن Function.

وظيفتها:

- توجيه المودل لمقارنة التسليم فقط مع المرشحين الداخليين
- إنتاج مخرجات منظمة
- تلخيص الشبهات
- تحديد مستوى الخطورة
- إبراز المقاطع المشبوهة

**مؤكد من الكود:** هناك ثابت/نسخة prompt باسم:

- `PROMPT_VERSION = "originality-v1"`

**مهم:**  
لا توجد حاجة لنسخ النص الكامل للتعليمات في التوثيق، لكن وظيفتها المؤكدة هي:

- ضبط السياق
- حصر التحليل في المقارنة الداخلية
- فرض هيكل بيانات متوقع في الاستجابة

## كيف تتم معالجة الاستجابة
**مؤكد من الكود:**

بعد استلام الاستجابة من Gemini:

- يتم parse للـ JSON الناتج
- اشتقاق:
  - `overall originality`
  - `estimated similarity`
  - `risk level`
  - `recommended status`
  - `teacher summary`
  - `student summary`
  - `reasoning notes`
  - `suspicious sections`
  - `internal matches`
- ثم الحفظ في الجداول المناسبة

## كيف تعرض النتائج في الواجهة
### للطالب
**مؤكد من `StudentOriginality.tsx`:**

- مقياس الأصالة
- النسبة
- مستوى الخطر
- ملخص آمن للطالب
- حالة التحليل

### للمعلم
**مؤكد من `TeacherReview.tsx`:**

- نسبة الأصالة
- نسبة التشابه
- درجة الثقة
- توصية التحليل
- حالة التحليل
- المقاطع المشبوهة
- أعلى التطابقات الداخلية
- سجل المراجعة

### في التقارير والتحليلات
- `TeacherReports.tsx`
- `TeacherAnalytics.tsx`
- `AdminReports.tsx`
- `AdminDashboard.tsx`

## التعامل مع الأخطاء
### مؤكد
الحالات التالية معالجة داخل Function:

- الملف غير موجود
- فشل استخراج النص
- النص قصير جدًا للتحليل
- فشل Gemini
- فشل parsing

والنتائج الممكنة تشمل:

- `completed`
- `failed`
- `manual_review_required`

### في الواجهة
- Toasts ورسائل حالة
- إظهار pending/manual/failed/completed
- تم تحسين إظهار رسائل الخطأ الفعلية في صفحات المعلم

## هل يوجد Streaming
**غير موجود في الكود المكتشف.**

## هل يوجد حفظ للنتائج
**نعم، ومؤكد.**

الجداول المستخدمة:

- `originality_checks`
- `submission_matches`
- `submissions`

## هل يوجد retries أو fallbacks
### مؤكد
- يوجد fallback تشغيلي من نوع:
  - تحويل التحليل إلى `manual_review_required` إذا فشل استخراج النص أو لم يكن النص كافيًا، حسب الإعدادات

### غير مؤكد
- لا يظهر من الكود retry policy منظمة متعددة المحاولات على استدعاء Gemini نفسه

## هل يوجد ربط بين AI وSupabase
**نعم، ومؤكد.**

الربط يتم عبر:

1. قراءة التسليم من قاعدة البيانات
2. تحميل الملف من Storage
3. استخدام إعدادات النظام من `system_settings`
4. كتابة النتائج إلى `originality_checks` و`submission_matches`
5. تحديث `submissions`

## هل توجد صلاحيات على استخدام الذكاء الاصطناعي
**نعم، ومؤكد.**

التحليل لا يمكن تشغيله عشوائيًا، بل وفقًا لصلاحية:

- الطالب صاحب التسليم
- المعلم صاحب التكليف
- الأدمن

## هل يوجد logging / observability / usage tracking
### مؤكد
- `activity_logs` تسجل أجزاء من lifecycle المرتبط بالتحليل والنتائج

### غير مؤكد
- لا يوجد دليل واضح على منصة خارجية مستقلة للمراقبة مثل Sentry/Datadog
- لا يوجد usage dashboard مستقل لاستهلاك Gemini

## مخاطر الأمان والخصوصية
### مؤكد
- الملفات الطلابية تخرج من Storage وتُحلل داخل Edge Function
- النتيجة النهائية تتضمن summaries ومقاطع مشبوهة وتطابقات داخلية
- تم إخفاء بعض التفاصيل عن الطالب عبر RPCs مفلترة

### مستنتج بدرجة عالية
- أي سوء ضبط في صلاحيات قراءة `originality_checks` أو `submission_matches` قد يكشف تفاصيل حساسة
- التحليل يعتمد على إرسال نصوص الطلاب إلى مزود AI خارجي، وبالتالي توجد اعتبارات خصوصية/امتثال يجب تقييمها تنظيميًا

## ما هو المؤكد وما هو غير المؤكد
### مؤكد
- المزود: Gemini
- نقطة التنفيذ: Edge Function
- نوع الاستخدام: تحليل أصالة داخلي قائم على مقارنة تسليمات داخلية
- النتائج محفوظة في Supabase
- لا يوجد Chat ولا Embeddings ولا RAG

### مستنتج بدرجة عالية
- Gemini يستخدم هنا كمفسر/محلل structured reasoning فوق بيانات مقارنة داخلية

### غير مؤكد
- لا يمكن الجزم من الكود وحده بالضبط كيف يتصرف Gemini على كل حالة edge case في الإنتاج
- لا يمكن الجزم من الكود وحده بسياسات retention أو data governance لدى بيئة الإنتاج الخارجية

## خلاصة
الذكاء الاصطناعي في هذا المشروع **ليس طبقة مستقلة من المنتج**، بل هو خدمة تحليل ضمن workflow أكاديمي واضح:

- الطالب يرفع
- النظام يستخرج النص
- النظام يقارن داخليًا
- Gemini يفسر ويصنف
- النتائج تحفظ
- المعلم يراجع ويقرر

وهذا يجعل `analyze-submission/index.ts` هو الملف المحوري لفهم الذكاء الاصطناعي في النظام.
