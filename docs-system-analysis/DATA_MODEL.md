# DATA_MODEL

## نظرة عامة
هذا الملف يصف نموذج البيانات المستنتج من:

- `src/lib/academic-data.ts`
- `src/integrations/supabase/types.ts`
- `src/lib/supabase-app.ts`
- `supabase/migrations/*.sql`

ويربط الكيانات بالواجهات والعمليات.

## الكيانات الرئيسية
### 1. المستخدم / الملف الشخصي `profiles`
**الدور:** يمثل الحساب التشغيلي داخل النظام بعد المصادقة.

#### حقول مهمة مؤكدة
- `id`
- `academic_id`
- `email`
- `full_name`
- `full_name_ar`
- `full_name_en`
- `role`
- `department`
- `role_title`
- `employee_number`
- `level`
- `semester`
- `must_change_password`
- `first_login`
- `default_password_flag`

#### يرتبط بـ
- `teacher_subjects`
- `student_subjects`
- `assignments.teacher_id`
- `submissions.student_id`
- `reviews.teacher_id`
- `notification_reads.user_id`
- `activity_logs.actor_id`

### 2. المادة `subjects`
**الدور:** دليل المواد الأكاديمية.

#### حقول مهمة مؤكدة
- `id`
- `name_ar`
- `name_en`
- `code`
- `department`
- `level`
- `semester`
- `status`
- timestamps

#### يرتبط بـ
- `teacher_subjects.subject_id`
- `student_subjects.subject_id`
- `assignments.subject_id`

### 3. ربط المعلم بالمادة `teacher_subjects`
**الدور:** يحدد المواد التي يدرّسها المعلم.

#### حقول مؤكدة
- `id`
- `teacher_id`
- `subject_id`
- `created_at`

#### ملاحظات
- الشُعب الأكاديمية أزيلت من البنية الحية لاحقًا

### 4. ربط الطالب بالمادة `student_subjects`
**الدور:** يحدد المواد التي يحق للطالب رؤية تكليفاتها صراحة.

#### حقول مؤكدة
- `id`
- `student_id`
- `subject_id`
- `created_at`

### 5. التكليف `assignments`
**الدور:** يمثل مهمة أكاديمية ينشئها المعلم.

#### حقول مهمة مؤكدة
- `id`
- `title`
- `subject` (تاريخي/نصي)
- `subject_id`
- `teacher_id`
- `teacher_name`
- `level`
- `due_at`
- `due_time`
- `description`
- `instructions`
- `allowed_formats`
- `max_submissions`
- `has_attachment`
- `attachments`
- `resubmission_policy`
- `status`
- timestamps

#### ملاحظات
- `word_protection_enabled` أزيل من البنية الحية
- `section_label` أزيل من البنية الحية

### 6. التسليم `submissions`
**الدور:** يمثل ملف الطالب المرفوع لتكليف معين.

#### حقول مهمة مؤكدة
- `id`
- `assignment_id`
- `student_id`
- `student_name`
- `academic_id`
- `file_name`
- `file_path`
- `file_mime_type`
- `file_size`
- `notes`
- `submitted_at`
- `originality`
- `status`
- `grade`
- `feedback`
- `semester`
- `events`
- `analysis_status`
- `analysis_requested_at`
- `analysis_completed_at`
- `analysis_error`
- `latest_originality_check_id`
- timestamps

#### علاقة uniqueness
- `unique (assignment_id, student_id)` في النسخة الأساسية

### 7. المراجعة `reviews`
**الدور:** قرار المعلم النهائي على التسليم.

#### حقول مهمة مستنتجة من migrations/types
- `id`
- `submission_id`
- `teacher_id`
- `final_decision`
- `grade`
- `comments`
- `reviewed_at`
- timestamps

### 8. نتيجة الأصالة `originality_checks`
**الدور:** الحاوية الرئيسية لنتيجة التحليل.

#### حقول مهمة مؤكدة من المايغريشن والواجهة
- `id`
- `submission_id`
- `analysis_status`
- `risk_level`
- `recommended_status`
- `overall_originality`
- `estimated_similarity`
- `confidence_score`
- `summary_for_student`
- `summary_for_teacher`
- `summary_for_admin`
- `reasoning_notes`
- `suspicious_sections`
- `raw_response`
- `analysis_started_at` / timestamps
- `model_name` أو ما يكافئه في الاستجابة المحفوظة

### 9. التطابقات الداخلية `submission_matches`
**الدور:** تخزين التطابقات المكتشفة بين التسليم الحالي ومرشحين داخليين.

#### حقول مؤكدة/مرجحة بدرجة عالية
- `id`
- `submission_id`
- `matched_submission_id`
- `matched_student_id`
- `match_type`
- `match_source_scope`
- `similarity_percent`
- `excerpt_current`
- `excerpt_matched`
- `reason`
- timestamps

### 10. سجل النشاطات `activity_logs`
**الدور:** feed إداري للأحداث التشغيلية.

#### حقول مؤكدة
- `id`
- `actor_id`
- `actor_name`
- `actor_role`
- `action`
- `details`
- `category`
- `status_label`
- `status_variant`
- `priority`
- `entity_type`
- `entity_id`
- `metadata`
- `occurred_at`
- `created_at`

### 11. إعدادات النظام `system_settings`
**الدور:** singleton إعدادات عامة تتحكم في الرفع والتحليل والعتبات.

#### حقول مهمة مؤكدة
- `id`
- `institution_name`
- `academic_year`
- `max_upload_size_mb`
- `allowed_submission_formats`
- `medium_risk_below`
- `high_risk_below`
- `suspicious_alert_below`
- `manual_review_on_extraction_failure`
- `auto_start_analysis`
- `updated_by`
- timestamps

### 12. قراءة الإشعارات `notification_reads`
**الدور:** حفظ حالة القراءة لكل مستخدم.

#### حقول مؤكدة
- `id`
- `user_id`
- `notification_id`
- `read_at`
- `created_at`

### 13. نطاقات المعلم `teacher_departments`
**الدور:** ربط إداري مساعد للمعلم مع القسم/الجهة.

#### مؤكد من المايغريشنات وFunctions
- يستخدم أثناء إنشاء/تحديث بعض حسابات المعلمين

## العلاقات بين الكيانات
### العلاقات الأساسية
- `profiles (teacher)` 1..* -> `assignments`
- `subjects` 1..* -> `assignments`
- `assignments` 1..* -> `submissions`
- `submissions` 0..1 -> `reviews`
- `submissions` 0..* -> `originality_checks`
- `submissions` 0..* -> `submission_matches`
- `profiles (teacher)` *..* -> `subjects` عبر `teacher_subjects`
- `profiles (student)` *..* -> `subjects` عبر `student_subjects`
- `profiles` 0..* -> `notification_reads`
- `profiles` 0..* -> `activity_logs`

## كيف ترتبط بالواجهات
### الطالب
- `subjects`, `student_subjects`, `assignments` -> صفحات المواد والتكليفات
- `submissions` -> حالة التسليم والسجل
- `originality_checks` -> صفحة الأصالة
- `reviews`, `submissions.grade` -> الدرجات

### المعلم
- `teacher_subjects`, `subjects` -> إنشاء التكليف
- `assignments` -> إدارة التكليفات
- `submissions` -> صندوق التسليمات
- `originality_checks`, `submission_matches` -> المراجعة والتقارير
- `reviews` -> القرار والدرجة

### الأدمن
- `profiles` -> إدارة المستخدمين
- `subjects` -> إدارة المواد
- `activity_logs` -> سجل النشاطات
- `system_settings` -> إعدادات النظام
- `submissions` + `originality_checks` + `submission_matches` -> تقارير القضايا

## كيف ترتبط بـ Supabase
### Database
- الجداول الأساسية كلها في Postgres

### Storage
- `assignments.attachments` ترتبط بملفات في `assignment-attachments`
- `submissions.file_path` يرتبط بملفات في `student-submissions`

### Edge Functions
- `analyze-submission` يقرأ `submissions` وStorage ويكتب `originality_checks` و`submission_matches`
- Functions الإدارية تعدل `profiles` و`auth.users` وكيانات الربط

## كيف ترتبط بالذكاء الاصطناعي
### مؤكد
- `submissions` هي نقطة دخول التحليل
- `originality_checks` تمثل ناتج التحليل الرئيسي
- `submission_matches` تمثل الأدلة الداخلية
- `system_settings` تؤثر على سلوك التحليل

## البيانات المحلية / الـ state المهمة
### داخل React state / Context
- `AuthContext.user`
- `AcademicDataContext` slices:
  - subjects
  - assignments
  - submissions
  - reviews
  - originality checks
  - mappings
  - system settings
- `NotificationsContext`

### localStorage / session-like state
**مؤكد من الكود:**

- `theme`
- `academic-iqama.auth.users`
- `academic-iqama.auth.session`
- مفاتيح تفضيلات المستخدم في `user-preferences.ts`

## بيانات مشتقة وليست جداول مباشرة
### في `academic-data.ts`
- مؤشرات الخطورة
- summaries
- subject directories
- accessibility checks

### في `use-notifications.ts`
- إشعارات مشتقة من البيانات وليست دائمًا جدولًا مستقلًا

## ملاحظات
### مؤكد
- بعض الحقول التاريخية بقيت في migrations الأقدم لكن أزيلت من البنية الحية لاحقًا
- النظام يعتمد على `profiles.role` بشكل محوري في أغلب العلاقات والسماح

### غير مؤكد
- بعض التفاصيل الدقيقة لبعض الأعمدة في `originality_checks` و`submission_matches` قد تكون أوسع مما تم استنتاجه من الواجهة وحدها، لكن الهيكل العام مؤكد من المايغريشنات والسلوك

## خلاصة
نموذج البيانات في المشروع ليس مجرد CRUD بسيط، بل مبني حول محور:

- مستخدم
- مادة
- تكليف
- تسليم
- تحليل أصالة
- مراجعة

وهذا المحور نفسه هو ما يربط:

- واجهات الطالب
- واجهات المعلم
- واجهات الأدمن
- Supabase
- وGemini
