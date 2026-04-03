# admin-create-user

Edge Function إدارية لإنشاء مستخدم جديد في `auth.users` وتحديث صف `profiles` المرتبط به.

## المتطلبات

- يجب أن يكون المستدعي مستخدمًا مصادقًا بدور `admin`
- تعتمد الدالة على:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Request Body

```json
{
  "email": "new.user@university.edu",
  "password": "TempPass@123",
  "role": "student",
  "full_name": "طالب جديد",
  "full_name_ar": "طالب جديد",
  "full_name_en": "New Student",
  "identifier": "202399999",
  "department": "كلية الحاسوب",
  "role_title": "طالب",
  "level": "المستوى الرابع",
  "semester": "الفصل الثاني 1447",
  "force_password_change": true
}
```

## Response

```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "email": "new.user@university.edu",
    "academicId": "202399999",
    "fullName": "طالب جديد",
    "role": "student",
    "department": "كلية الحاسوب",
    "roleTitle": "طالب",
    "mustChangePassword": true
  }
}
```
