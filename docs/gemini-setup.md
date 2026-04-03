# Gemini Setup

هذا المشروع لا يحتاج منك كتابة prompt داخل Google AI Studio أو داخل واجهة Gemini.

السبب:
- الـ prompt الخاص بتحليل الأصالة موجود داخل `Supabase Edge Function`
- المفتاح يجب أن يبقى سرياً داخل `Supabase secrets`
- الواجهة الأمامية `React` يجب ألا ترى المفتاح أبداً

## ما الذي أحتاجه منك

فقط:

```bash
GEMINI_API_KEY=your-gemini-api-key
```

ويمكنك اختيارياً تحديد المودل:

```bash
GEMINI_MODEL=gemini-2.5-flash
```

## أين يوضع المفتاح

يوضع داخل أسرار Supabase Edge Functions، وليس في `.env` الخاص بالواجهة.

مثال:

```bash
supabase secrets set GEMINI_API_KEY=your-gemini-api-key
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

`SUPABASE_URL` و`SUPABASE_ANON_KEY` و`SUPABASE_SERVICE_ROLE_KEY` يتم توفيرها تلقائياً داخل Edge Functions على المشروع المستضاف، لذلك لا تحتاج إضافتها يدويًا من شاشة secrets.

## أين يوجد الـ prompt الآن

الـ prompt موجود داخل:

- `supabase/functions/analyze-submission/index.ts`

وهو مصمم لهذا الدور:
- تحليل الأصالة داخلياً بين تسليمات الطلاب
- التمييز بين التشابه الحرفي وإعادة الصياغة والتداخل الأكاديمي الطبيعي
- إرجاع JSON منظم فقط
- إبقاء القرار النهائي بيد المعلم أو الإدارة

## ماذا لا تحتاج أن تفعله

- لا تضع المفتاح في الواجهة
- لا تكتب prompt يدوي داخل Gemini Console
- لا تستدعي Gemini مباشرة من React

## إذا أردت أن ترسل المفتاح لي الآن

عملياً أنا لا أحتاجه داخل المحادثة لكي أكمل بناء الكود.

الأنسب:
- أنا أكمل تجهيز المشروع والكود
- وأنت تضيف `GEMINI_API_KEY` داخل Supabase secrets
- وبعدها نكمل الاختبار الفعلي على مشروع Supabase الحقيقي
