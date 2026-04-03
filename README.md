# Academic Iqama

نظام أكاديمي عربي مبني بـ `React + Vite + TypeScript + Tailwind + shadcn/ui` لثلاث بوابات:

- الطالب
- المعلم
- الإدارة

المشروع يعمل حالياً بطبقتين:

- `local mode`: بيانات تجريبية محفوظة في `localStorage`
- `supabase mode`: جاهزية للربط الحقيقي بقاعدة Supabase

## التشغيل المحلي

```bash
npm install
npm run dev
```

## التحقق

```bash
npm run lint
npm run build
npm test
npm run supabase:check
npm run supabase:check:repo
```

## الحسابات التجريبية

- طالب: `202312345 / 123456`
- معلم: `9001001 / Teacher@123`
- إدارة: `1000001 / Admin@123`

## Supabase

إذا لم توجد جلسة فعلية أو لم تكتمل تهيئة البيئة، سيبقى التطبيق على `local mode`.

### ملفات الربط المهمة

- [src/contexts/AuthContext.tsx](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/src/contexts/AuthContext.tsx)
- [src/contexts/AcademicDataContext.tsx](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/src/contexts/AcademicDataContext.tsx)
- [src/lib/supabase-app.ts](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/src/lib/supabase-app.ts)
- [supabase/migrations/202603220001_initial_schema.sql](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/migrations/202603220001_initial_schema.sql)
- [supabase/migrations/202603230001_originality_v1_foundation.sql](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/migrations/202603230001_originality_v1_foundation.sql)
- [supabase/functions/analyze-submission/index.ts](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/functions/analyze-submission/index.ts)
- [supabase/functions/analyze-submission/README.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/functions/analyze-submission/README.md)

## إعداد البيئة

أنشئ إعدادات الواجهة من `.env.example` أو `.env.local.example` إلى `.env` أو `.env.local` ثم أضف:

```bash
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_URL=https://your-project.supabase.co
```

ولتهيئة الملفات المحلية بسرعة:

```bash
npm run supabase:env:plan
npm run supabase:env:init
```

ثم أنشئ إعدادات الفنكشن من `supabase/.env.example` أو `supabase/.env.local.example` إلى `supabase/.env.local` أو `supabase/.env`، وأضف داخل أسرار Supabase Edge Functions:

```bash
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

Hosted Edge Functions already receive `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from Supabase automatically.

أوامر Supabase المضافة حالياً:

- `npm run supabase:check:start`
- `npm run supabase:check:db`
  validates CLI/config plus local `supabase/migrations` integrity
  and required schema artifacts used by the app
- `npm run supabase:check:repo`
  validates checked-in Supabase config, migrations, schema artifacts, and function files without requiring local CLI or secrets
- `npm run supabase:check:frontend`
- `npm run supabase:check:function`
  validates function env plus local `analyze-submission` files
- `npm run supabase:check:serve`
- `npm run supabase:check:deploy`
- `npm run supabase:db:bundle`
- `npm run supabase:e2e:healthcheck`
- `npm run supabase:start`
- `npm run supabase:db:push`
- `npm run supabase:functions:serve`
- `npm run supabase:functions:deploy`

إذا كان `supabase db push` متوقفًا بسبب `Supabase CLI` أو الربط بالمشروع البعيد، يمكنك توليد ملف SQL واحد من جميع المايغريشنز:

```bash
npm run supabase:db:bundle
```

وسيتم إنشاء [supabase/manual-deploy.sql](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/manual-deploy.sql) لتشغيله من `Supabase SQL Editor` كمسار يدوي بديل.

## الأصالة V1

تمت إضافة أساس `V1` للأصالة مع:

- جداول `subjects`, `teacher_subjects`, `teacher_departments`
- جداول `reviews`, `originality_checks`, `submission_matches`
- حالات تحليل `pending / processing / completed / failed / manual_review_required`
- bucket للتكليفات وbucket لتسليمات الطلاب
- `Edge Function` أولية باسم `analyze-submission`

تدفق الدالة الحالية:

- تجلب بيانات التسليم
- تحمل الملف من `student-submissions`
- تحاول استخراج النص من `PDF/DOCX`
- ترتب أعلى المرشحين الداخليين
- ترسل التحليل إلى Gemini بصيغة JSON منظمة
- تحفظ النتائج في `originality_checks` و`submission_matches`

## الحالة الحالية

- المسارات الأساسية في بوابات `الإدارة` و`المعلم` و`الطالب` مربوطة مع Supabase.
- رفع الملفات مربوط مع `Supabase Storage`.
- تحليل الأصالة مربوط مع `Edge Function` باسم `analyze-submission` ومع Gemini لتفسير النتيجة وتلخيصها.
- الإشعارات تعمل، وفي وضع `supabase mode` يتم حفظ حالة القراءة في قاعدة البيانات.
- فحص الأصالة الحالي هو **فحص تشابه/أصالة داخلي** بين تسليمات الطلاب داخل النظام، وليس كاشفًا مستقلًا "للنص المولد بالذكاء الاصطناعي" إذا لم يوجد تطابق داخلي.

## تنظيف اختياري بعد الإطلاق

إذا أردت تنظيفًا نهائيًا للبيئة الحية بعد الانتهاء من التطوير، فالمناسب الآن هو:

1. حذف الأعمدة القديمة غير المستخدمة مثل `section_label` و`word_protection_enabled` من خلال تشغيل:
   [supabase/migrations/202603280001_remove_sections_and_word_protection.sql](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/migrations/202603280001_remove_sections_and_word_protection.sql)
   داخل `Supabase SQL Editor`.
2. تنظيف بيانات الاختبار أو الـ smoke فقط عندما تتأكد أنك لم تعد تحتاجها، عبر:

```bash
node scripts/live-cleanup-demo-data.mjs --include-manual-demo
node scripts/live-cleanup-demo-data.mjs --include-manual-demo --apply
```

الأمر الأول للمعاينة فقط، أما `--apply` فهو حذف فعلي.
