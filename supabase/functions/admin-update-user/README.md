# admin-update-user

Edge Function إدارية لتحديث مستخدم موجود في `auth.users` و`profiles` مع الحفاظ على التكامل بين الدور والمعرّف والبيانات الأكاديمية المرتبطة.

## المتطلبات

- يجب أن يكون المستدعي مستخدمًا مصادقًا بدور `admin`
- تعتمد الدالة على:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Request Body

```json
{
  "user_id": "uuid",
  "email": "teacher.updated@university.edu",
  "role": "teacher",
  "full_name": "عضو هيئة التدريس المحدث",
  "full_name_ar": "عضو هيئة التدريس المحدث",
  "full_name_en": "Updated Teacher",
  "identifier": "9001999",
  "department": "كلية الحاسوب",
  "role_title": "عضو هيئة تدريس",
  "level": "المستوى السادس",
  "semester": "الفصل الثاني 1447",
  "force_password_change": false,
  "password": "Teacher@123"
}
```

`password` اختياري، ويُستخدم فقط إذا أراد الأدمن إعادة تعيين كلمة المرور.

## Response

```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "email": "teacher.updated@university.edu",
    "academicId": "9001999",
    "fullName": "عضو هيئة التدريس المحدث",
    "role": "teacher",
    "department": "كلية الحاسوب",
    "roleTitle": "عضو هيئة تدريس",
    "mustChangePassword": false
  }
}
```
