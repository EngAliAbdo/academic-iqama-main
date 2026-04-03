# PROJECT_STRUCTURE

## شجرة مختصرة للمجلدات والملفات المهمة
```text
.
├─ public/
├─ docs/
├─ scripts/
│  ├─ lib/
│  └─ live-*.mjs
├─ src/
│  ├─ components/
│  │  └─ ui/
│  ├─ contexts/
│  ├─ hooks/
│  ├─ integrations/supabase/
│  ├─ lib/
│  ├─ pages/
│  │  ├─ admin/
│  │  ├─ student/
│  │  └─ teacher/
│  ├─ test/
│  ├─ App.tsx
│  └─ main.tsx
├─ supabase/
│  ├─ config.toml
│  ├─ functions/
│  ├─ manual-fixes/
│  ├─ manual-deploy.sql
│  └─ migrations/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ vitest.config.ts
└─ tailwind.config.ts
```

## شرح وظيفة كل مجلد رئيسي
### `src/`
الواجهة الكاملة للتطبيق:

- routing
- layouts
- pages
- services
- hooks
- contexts

### `src/components/`
مكونات الواجهة المشتركة:

- shell العام
- sidebar
- topbar
- breadcrumbs
- status components
- originality gauge
- timeline
- wrappers لعناصر Radix/shadcn

### `src/contexts/`
حاويات الحالة المركزية:

- `AuthContext.tsx`: الجلسة والهوية
- `AcademicDataContext.tsx`: بيانات النظام الأكاديمية
- `NotificationsContext.tsx`: الإشعارات

### `src/hooks/`
hooks مشتركة:

- `use-notifications.ts`
- `use-system-settings.ts`
- `use-theme.ts`
- `use-mobile.tsx`

### `src/integrations/supabase/`
إنشاء Supabase client والأنواع المتولدة/المعرّفة.

### `src/lib/`
طبقة المنطق والخدمات:

- `supabase-app.ts`
- `academic-data.ts`
- `auth.ts`
- `system-settings.ts`
- `activity-feed.ts`
- `subject-directory.ts`
- `admin-user-api.ts`
- `report-export.ts`

### `src/pages/`
شاشات النظام حسب الدور:

- public/shared
- student
- teacher
- admin

### `src/test/`
اختبارات وحدات وسلامة الأدوات والـ scripts.

### `supabase/`
طبقة التشغيل الخلفية:

- migrations
- edge functions
- config
- manual deploy artifacts

### `scripts/`
أدوات تشغيل وفحص وصيانة:

- صحة الإعدادات
- bundling SQL
- smoke tests
- cleanup

## Entry points
### الواجهة
- `index.html`
- `src/main.tsx`
- `src/App.tsx`

### bootstrap
`src/main.tsx` هو bootstrap React الفعلي.

## ملفات App / main / index / bootstrap
### `src/App.tsx`
أهم ملف لفهم التطبيق لأنه:

- يثبت providers
- يحدد routes
- يربط الحماية حسب الدور

### `src/main.tsx`
ينشئ React root ويستورد CSS.

### `index.html`
نقطة تحميل SPA.

## ملفات router والتنقل
- `src/App.tsx`
- `src/components/AuthRoutes.tsx`
- `src/components/AppLayout.tsx`
- `src/components/AppSidebar.tsx`
- `src/components/TopBar.tsx`

## pages / views / screens
### عامة ومشتركة
- `LandingPage.tsx`
- `LoginPage.tsx`
- `ForgotPasswordPage.tsx`
- `ChangePasswordPage.tsx`
- `NotificationsPage.tsx`
- `ProfilePage.tsx`
- `SettingsPage.tsx`
- `NotFound.tsx`

### الطالب
- `StudentDashboard.tsx`
- `StudentSubjects.tsx`
- `StudentAssignments.tsx`
- `StudentUpload.tsx`
- `StudentStatus.tsx`
- `StudentOriginality.tsx`
- `StudentGrades.tsx`
- `StudentHistory.tsx`
- `StudentCalendar.tsx`

### المعلم
- `TeacherDashboard.tsx`
- `TeacherCreateAssignment.tsx`
- `TeacherAssignments.tsx`
- `TeacherSubmissions.tsx`
- `TeacherReview.tsx`
- `TeacherAnalytics.tsx`
- `TeacherReports.tsx`

### الإدارة
- `AdminDashboard.tsx`
- `AdminUsers.tsx`
- `AdminRoles.tsx`
- `AdminSubjects.tsx`
- `AdminActivity.tsx`
- `AdminReports.tsx`
- `AdminSettings.tsx`

## components
### المكونات المحورية
- `AppLayout.tsx`
- `AppSidebar.tsx`
- `AuthRoutes.tsx`
- `TopBar.tsx`
- `OriginalityGauge.tsx`
- `TimelineStepper.tsx`
- `StatusBadge.tsx`
- `StatCard.tsx`
- `EmptyState.tsx`

### مكونات UI framework
كل ما تحت `src/components/ui/*` هو طبقة wrapper جاهزة لعناصر:

- dialog
- alert
- table
- select
- tabs
- switch
- checkbox
- form
- toast
- tooltip

## services / api / hooks / utils
### services / api
- `src/lib/supabase-app.ts`
- `src/lib/admin-user-api.ts`
- `src/lib/report-export.ts`

### domain / utils
- `src/lib/academic-data.ts`
- `src/lib/system-settings.ts`
- `src/lib/subject-directory.ts`
- `src/lib/activity-feed.ts`
- `src/lib/role-capabilities.ts`
- `src/lib/user-preferences.ts`
- `src/lib/utils.ts`

## ملفات Supabase
### client
- `src/integrations/supabase/client.ts`

### types
- `src/integrations/supabase/types.ts`

### config
- `supabase/config.toml`

### functions
- `supabase/functions/analyze-submission/index.ts`
- `supabase/functions/admin-create-user/index.ts`
- `supabase/functions/admin-update-user/index.ts`
- `supabase/functions/admin-delete-user/index.ts`
- `supabase/functions/admin-delete-subject/index.ts`

### schema / migrations
- `supabase/migrations/*.sql`

## ملفات التكامل مع الذكاء الاصطناعي
### محورية
- `supabase/functions/analyze-submission/index.ts`
- `supabase/functions/analyze-submission/README.md`
- `docs/gemini-setup.md`

## ملفات auth / session / permissions
- `src/contexts/AuthContext.tsx`
- `src/lib/auth.ts`
- `src/components/AuthRoutes.tsx`
- `src/lib/supabase-app.ts`
- `supabase/migrations/202603230004_assignment_scope_rls.sql`
- `supabase/migrations/202603230003_accessible_originality_checks.sql`
- `supabase/migrations/202603240003_accessible_reviews.sql`

## ملفات SQL / schema / migrations
الأكثر محورية:

- `supabase/migrations/202603220001_initial_schema.sql`
- `supabase/migrations/202603230001_originality_v1_foundation.sql`
- `supabase/migrations/202603230004_assignment_scope_rls.sql`
- `supabase/migrations/202603230005_activity_logs.sql`
- `supabase/migrations/202603230006_system_settings.sql`
- `supabase/migrations/202603260002_notification_reads.sql`
- `supabase/migrations/202603260003_student_subject_enrollments.sql`
- `supabase/migrations/202603280001_remove_sections_and_word_protection.sql`

## الملفات الأكثر محورية في فهم المشروع
1. `src/App.tsx`
2. `src/contexts/AuthContext.tsx`
3. `src/contexts/AcademicDataContext.tsx`
4. `src/lib/supabase-app.ts`
5. `src/lib/academic-data.ts`
6. `src/hooks/use-notifications.ts`
7. `supabase/functions/analyze-submission/index.ts`
8. `supabase/migrations/202603220001_initial_schema.sql`
9. `supabase/migrations/202603230001_originality_v1_foundation.sql`
10. `supabase/migrations/202603230004_assignment_scope_rls.sql`

## ملاحظات
### مؤكد
- الفصل بين الواجهة والمنطق وطبقة Supabase واضح نسبيًا.
- `src/lib/supabase-app.ts` هو مركز الربط الأكثر أهمية.

### غير مؤكد
- `src/pages/Index.tsx` موجود في الشجرة لكنه غير ظاهر كمسار أساسي داخل `App.tsx`، ويبدو ملفًا قديمًا أو غير مستخدم حاليًا.
