# AUTH_AND_PERMISSIONS

## Scope
This document describes the authentication, session management, route protection, and permission model implemented in the repository as observed from code.

Primary references:

- `src/contexts/AuthContext.tsx`
- `src/components/AuthRoutes.tsx`
- `src/lib/auth.ts`
- `src/lib/supabase-app.ts`
- `src/integrations/supabase/client.ts`
- `src/App.tsx`
- `supabase/migrations/*.sql`
- `supabase/functions/admin-create-user/index.ts`
- `supabase/functions/admin-update-user/index.ts`
- `supabase/functions/admin-delete-user/index.ts`
- `supabase/functions/admin-delete-subject/index.ts`
- `supabase/functions/analyze-submission/index.ts`

## Confidence Legend

- **Confirmed from code**: directly visible in source.
- **High-confidence inference**: strongly implied by source usage and naming.
- **Uncertain**: cannot be fully proven from repository contents alone.

## Authentication Modes

### Confirmed from code
The frontend supports two auth modes in `src/contexts/AuthContext.tsx`:

- `local`
- `supabase`

Selection is based on:

- `isSupabaseConfigured()` from `src/lib/supabase-app.ts`
- `isLocalDemoFallbackEnabled()` from `src/lib/supabase-app.ts`

### Local mode
Local mode uses browser storage and demo accounts defined in `src/lib/auth.ts`.

Important storage keys:

- `academic-iqama.auth.users`
- `academic-iqama.auth.session`

Known demo credentials in code:

- Student: `student@university.edu` / `202312345`
- Teacher: `teacher@university.edu` / `9001001`
- Admin: `admin@university.edu` / `1000001`

### Supabase mode
Supabase mode uses:

- `supabase.auth.getSession()`
- `supabase.auth.signInWithPassword(...)`
- `supabase.auth.signOut()`
- `supabase.auth.resetPasswordForEmail(...)`
- `supabase.auth.updateUser(...)`
- `supabase.auth.onAuthStateChange(...)`

The client is created in `src/integrations/supabase/client.ts`.

## Login Flow

### Confirmed from code
The main login entry is `signIn` inside `src/contexts/AuthContext.tsx`.

In Supabase mode, login is not performed directly with the typed identifier. Instead:

1. The user enters an academic number, employee number, or email.
2. `signInWithSupabaseIdentifier(...)` is called from `src/lib/supabase-app.ts`.
3. That helper resolves the identifier via the RPC `resolve_login_identifier`.
4. The resolved email is used in `supabase.auth.signInWithPassword(...)`.
5. After login, the active profile is loaded with `getSupabaseSessionProfile()`.

If Supabase is configured but the remote login fails and local fallback is enabled, the app can fall back to local mode.

## Session Management

### Confirmed from code
Session state is held in `AuthContext`:

- `user`
- `directoryUsers`
- `authMode`
- `isReady`

Supabase session persistence uses:

- `storage: localStorage`
- `persistSession: true`
- `autoRefreshToken: true`

in `src/integrations/supabase/client.ts`.

In local mode, session state is stored manually through helpers in `src/lib/auth.ts`.

`AuthProvider` also subscribes to `supabase.auth.onAuthStateChange(...)` and resynchronizes the app state.

## Password Reset and Password Change

### Confirmed from code
Relevant screens:

- `src/pages/ForgotPasswordPage.tsx`
- `src/pages/ChangePasswordPage.tsx`

Relevant backend interactions:

- `supabase.auth.resetPasswordForEmail(...)`
- `updateSupabasePasswordState(...)` in `src/lib/supabase-app.ts`

The system also enforces a `mustChangePassword` flag at the route level.

## Route Guards

### Confirmed from code
Route guards are implemented in `src/components/AuthRoutes.tsx`:

- `PublicOnlyRoute`
- `ProtectedRoute`

Rules:

- Unauthenticated users are redirected to `/login`.
- Authenticated users visiting public-only screens are redirected to their role home.
- Users flagged with `mustChangePassword` are redirected to `/change-password`.
- Role-restricted routes use `allowedRoles`.

Role home routing is derived from `getRoleHome(...)` in `src/lib/auth.ts`.

## Role Model

### Confirmed from code
Primary application roles:

- `student`
- `teacher`
- `admin`

Role-restricted route groups in `src/App.tsx`:

- Student routes under `/student/*`
- Teacher routes under `/teacher/*`
- Admin routes under `/admin/*`

Shared authenticated pages:

- `/notifications`
- `/profile`
- `/settings`
- `/change-password`

## Frontend Permissions by Role

### Confirmed from code
The UI structure and routes establish the following high-level access:

| Role | Major capabilities |
| --- | --- |
| Student | View subjects and assignments, upload files, view status/originality/grades/history/calendar |
| Teacher | Create assignments, inspect submissions, trigger analysis, review work, view analytics/reports |
| Admin | Manage users, subjects, reports, activity, and system settings |

### Confirmed from code
`AdminRoles.tsx` is not a dynamic permission editor. It is a descriptive oversight page.

## Supabase Authorization

### Confirmed from code
Supabase authorization is applied in multiple layers:

1. Frontend route restrictions
2. Context-level filtering and helper methods
3. Row Level Security policies in SQL migrations
4. Manual checks inside Edge Functions

## Database-Level Access Control

### Confirmed from code
The repository includes RLS- and access-related migrations, notably:

- `202603230004_assignment_scope_rls.sql`
- `202603240003_accessible_reviews.sql`
- `202603230003_accessible_originality_checks.sql`
- `202603260002_notification_reads.sql`
- `202603260003_student_subject_enrollments.sql`
- `202603280001_remove_sections_and_word_protection.sql`

The SQL function `public.can_student_access_assignment(target_assignment_id uuid)` is central to student assignment visibility.

Its final version allows access when:

- the assignment is `published`
- the user role is `student`
- assignment level constraints match
- and either:
  - the subject has explicit `student_subjects` enrollments and the current student is enrolled
  - or there are no explicit enrollments for that subject and the fallback department/level/semester scope matches

### Confirmed from code
`notification_reads` uses per-user RLS policies so each user can manage only their own rows.

## Edge Function Permissions

### Confirmed from code
The following Edge Functions are configured in `supabase/config.toml`:

- `analyze-submission`
- `admin-create-user`
- `admin-update-user`
- `admin-delete-user`
- `admin-delete-subject`

All are configured with `verify_jwt = false`.

### Confirmed from code
Despite `verify_jwt = false`, the functions manually validate caller identity by reading the `Authorization` header and checking profile role/ownership.

This pattern is visible in:

- `supabase/functions/admin-create-user/index.ts`
- `supabase/functions/admin-update-user/index.ts`
- `supabase/functions/admin-delete-user/index.ts`
- `supabase/functions/admin-delete-subject/index.ts`
- `supabase/functions/analyze-submission/index.ts`

## Important Permission Rules

### Confirmed from code
Admin-only operations:

- create/update/delete users
- delete subjects
- system-level management screens

Teacher-only operations:

- create assignments
- inspect teacher-owned submissions
- trigger or retry analysis for teacher-visible submissions
- review and grade submissions

Student-only operations:

- see accessible assignments
- upload submissions
- view personal status/originality/grades/history/calendar

## Manual Review vs Automatic Analysis

### Confirmed from code
`manual_review_required` is a real workflow state in the originality pipeline.

It is triggered when the automatic process cannot safely produce a reliable analysis, for example:

- file missing
- text extraction failure
- insufficient extracted text

### Confirmed from code
Manual teacher review is performed in `src/pages/teacher/TeacherReview.tsx` and written back through review/submission update paths in `src/lib/supabase-app.ts`.

## Security Observations

### Confirmed from code

- Frontend publishable key is taken from `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Service-role usage is kept inside Edge Functions and function-local environments.
- Frontend calls admin functions with user bearer tokens plus publishable key headers.

### High-confidence inference
The project intentionally keeps privileged mutations behind Edge Functions instead of exposing service-role operations to the frontend.

### Uncertain

- Whether all hosted RLS policies match the current repository migrations in every deployed environment
- Whether any external WAF, rate limiting, or audit middleware exists outside Supabase

## Known Gaps or Limits

### Confirmed from code

- `AdminRoles.tsx` does not implement dynamic RBAC authoring.
- User preferences in shared settings are per-user local preferences, not server-stored authorization settings.
- Email notification preference exists, but real email delivery is not implemented in the inspected frontend code.

## Final Assessment

### Confirmed from code
Authentication and permissions are implemented as a layered system:

1. frontend route guards
2. context/service restrictions
3. Supabase RLS and SQL access helpers
4. Edge Function role validation

For the core three roles (`student`, `teacher`, `admin`), the permission model is coherent and consistently reflected in routing, data access helpers, and backend mutations.
