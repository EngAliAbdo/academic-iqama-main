# PLATFORM_INTEGRATION

## مقدمة
هذا الملف يحصر أي ربط خارجي أو تكامل مع منصات أخرى خارج واجهة React نفسها.

**مؤكد من الكود:** لا يوجد backend تقليدي منفصل داخل المستودع.  
التكاملات الخارجية المؤكدة هي:

- Supabase
- Google Gemini
- Google Fonts

**غير مؤكد من الكود:** لا توجد منصة أعمال ثالثة أخرى موثقة بوضوح مثل ERP أو SIS أو LMS خارجي مستقل.

## 1. Supabase
### نوع التكامل
**مؤكد:** Supabase هو backend الرئيسي للنظام.

يشمل:

- Auth
- Database
- Storage
- Edge Functions
- RPC
- RLS

### الملفات المرتبطة
- `src/integrations/supabase/client.ts`
- `src/lib/supabase-app.ts`
- `src/contexts/AuthContext.tsx`
- `src/lib/admin-user-api.ts`
- `supabase/config.toml`
- `supabase/functions/*`
- `supabase/migrations/*`

### كيف تنتقل البيانات
1. الواجهة تستدعي `supabase-js` مباشرة
2. أو تستدعي Edge Functions عبر `fetch`
3. البيانات تعاد إلى `AcademicDataContext` أو `AuthContext`
4. الواجهة تعرض النتائج

### نقاط الفشل المحتملة
- فشل auth session
- فشل RLS أو mismatch في الدور
- فشل storage upload/download
- فشل Function invocation
- عدم اكتمال migrations في بيئة معينة

## 2. Google Gemini
### نوع التكامل
**مؤكد:** تكامل تحليل أصالة عبر REST API من داخل Edge Function.

### الملفات المرتبطة
- `supabase/functions/analyze-submission/index.ts`
- `supabase/functions/analyze-submission/README.md`
- `docs/gemini-setup.md`

### كيف تنتقل البيانات
1. Function تستخرج نص الملف
2. تبني مرشحين داخليين من قاعدة البيانات
3. ترسل النص والمرشحين إلى Gemini
4. تستقبل JSON منظم
5. تحفظ النتائج في Supabase

### المصادقة مع المنصة
**مؤكد من الكود:** تستخدم `GEMINI_API_KEY`

### نقاط الفشل المحتملة
- key غير صالح
- quota / rate limit
- failure in parsing
- استجابة غير متوافقة مع الصيغة المتوقعة

## 3. Google Fonts
### نوع التكامل
**مؤكد من `src/index.css`:**

- تحميل خط `Tajawal` من `fonts.googleapis.com` و`fonts.gstatic.com`

### الأثر
- تأثير بصري/طباعي فقط
- ليس جزءًا من منطق الأعمال

## 4. Edge Function HTTP surface
هذا ليس مزودًا مستقلًا، لكنه يمثل طبقة تكامل خارجية نسبيًا بين الواجهة وبيئة Deno الخاصة بـ Supabase.

### Functions المكتشفة
- `admin-create-user`
- `admin-update-user`
- `admin-delete-user`
- `admin-delete-subject`
- `analyze-submission`

### الملفات المرتبطة
- `src/lib/admin-user-api.ts`
- `src/lib/supabase-app.ts`
- `supabase/functions/*`

### نمط العمل
- الواجهة ترسل Bearer token
- Function تتحقق من المستخدم
- Function تستخدم service role داخليًا عند الحاجة
- النتيجة تعود كـ JSON

## 5. هل توجد Webhooks أو Callbacks
**غير مؤكد / غير ظاهر من الكود.**

لم يظهر:

- webhook endpoints مستقلة
- background queue خارج Supabase
- callback URLs من مزود خارجي

## 6. هل توجد مزامنة مع منصة أكاديمية أخرى
**غير مؤكد من الكود.**

لا يوجد دليل واضح على:

- استيراد بيانات من SIS خارجي
- مزامنة LDAP/SSO
- مزامنة LMS خارجي
- ERP integration

إذا كان هناك تكامل من هذا النوع فهو غير ظاهر في المستودع الحالي.

## 7. نقاط الفشل العامة
### مؤكد
- تعطل Supabase يعطل أغلب وظائف النظام في وضع الإنتاج
- تعطل Gemini لا يمنع الرفع نفسه، لكنه يعطل التحليل أو يحول الحالة إلى مراجعة يدوية/فشل

### مستنتج بدرجة عالية
- اعتماد الواجهة مباشرة على Supabase يقلل الطبقات، لكنه يجعل ضبط السياسات والوظائف السحابية حساسًا جدًا

## 8. ما هو المؤكد وما هو غير المؤكد
### مؤكد
- Supabase = المنصة الخلفية الرئيسية
- Gemini = مزود AI المستخدم
- Google Fonts = تكامل واجهة بسيط

### غير مؤكد
- عدم وجود منصات أخرى لا يمكن اعتباره حقيقة مطلقة خارج هذا المستودع، لكن من الكود الحالي لا يظهر شيء إضافي

## خلاصة
التكاملات الخارجية في النظام محدودة وواضحة:

- **Supabase** لإدارة التطبيق تشغيليًا
- **Gemini** لتحليل الأصالة
- **Google Fonts** للواجهة

ولا يظهر في المستودع الحالي ربط مؤكد مع منصة أعمال أو backend خارجي إضافي.
