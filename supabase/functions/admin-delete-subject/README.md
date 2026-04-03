# admin-delete-subject

Edge Function إدارية لحذف مادة من `subjects` بشكل آمن بعد التحقق من عدم وجود تكليفات أو ربط معلمين مرتبط بها.

## المتطلبات

- يجب أن يكون المستدعي مستخدمًا مصادقًا بدور `admin`
- تعتمد الدالة على:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Request Body

```json
{
  "subject_id": "uuid"
}
```

## ضوابط الحذف

- يمنع حذف المادة إذا كانت مرتبطة بأي `assignments`
- يمنع حذف المادة إذا كانت مرتبطة بأي `teacher_subjects`

## Response

```json
{
  "ok": true,
  "deleted_subject": {
    "id": "uuid",
    "name_ar": "مادة محذوفة",
    "code": "CS401"
  }
}
```
