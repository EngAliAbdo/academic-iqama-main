# admin-delete-user

Edge Function إدارية لحذف مستخدم من `auth.users` و`profiles`.

## المتطلبات

- يجب أن يكون المستدعي مستخدمًا مصادقًا بدور `admin`
- تعتمد الدالة على:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Request Body

```json
{
  "user_id": "uuid"
}
```

## ضوابط الحذف

- يمنع حذف الأدمن لنفسه
- يمنع حذف آخر حساب إدارة متبقٍ
- بخلاف ذلك، يسمح الحذف حتى إذا كانت هناك بيانات أكاديمية مرتبطة

## ملاحظات مهمة

- حذف المستخدم من `auth.users` سيؤدي إلى حذف صف `profiles` المرتبط به تلقائيًا
- العلاقات التي تستخدم `on delete cascade` ستُحذف معها بياناتها التابعة تلقائيًا
- العلاقات التي تستخدم `on delete set null` ستبقى ولكن مع تفريغ مرجع المستخدم

## Response

```json
{
  "ok": true,
  "deleted_user": {
    "id": "uuid",
    "email": "removed.user@university.edu",
    "full_name": "مستخدم محذوف",
    "role": "student"
  },
  "impact_summary": {
    "assignments": 0,
    "submissions": 0,
    "reviews": 0,
    "teacher_subjects": 0,
    "teacher_departments": 0,
    "student_subjects": 0,
    "notification_reads": 0
  }
}
```
