# USER_FLOWS

## Scope
This document describes the main end-to-end user journeys observed in the codebase.

References include:

- `src/App.tsx`
- `src/contexts/AuthContext.tsx`
- `src/contexts/AcademicDataContext.tsx`
- `src/lib/supabase-app.ts`
- `src/hooks/use-notifications.ts`
- `src/pages/**`
- `supabase/functions/**`

## Confidence Legend

- **Confirmed from code**
- **High-confidence inference**
- **Uncertain**

## 1. Public Login Flow

### Goal
Authenticate a user and send them to the correct role portal.

### Entry Point
- `src/pages/LoginPage.tsx`
- Route: `/login`

### Steps
1. User enters an identifier and password.
2. `AuthContext.signIn(...)` is called.
3. In Supabase mode:
   - `resolve_login_identifier` RPC resolves academic number/employee number/email.
   - `supabase.auth.signInWithPassword(...)` authenticates the user.
   - `getSupabaseSessionProfile()` loads the active profile.
4. On success:
   - if `mustChangePassword` is true, user is redirected to `/change-password`
   - otherwise user is redirected to the role home path

### Supabase Involvement
- `resolve_login_identifier`
- `supabase.auth.signInWithPassword`
- profile fetches through `src/lib/supabase-app.ts`

## 2. Password Reset and Password Change

### Entry Points
- `/forgot-password`
- `/change-password`

### Flow
1. User requests password reset from `ForgotPasswordPage.tsx`.
2. App calls `supabase.auth.resetPasswordForEmail(...)`.
3. If the user is forced to rotate password after login, route guards redirect to `ChangePasswordPage.tsx`.
4. New password is stored through:
   - `updateSupabasePasswordState(...)` in Supabase mode
   - local demo storage update in local mode

## 3. Admin Creates or Updates a User

### Entry Point
- `src/pages/admin/AdminUsers.tsx`
- Route: `/admin/users`

### Flow
1. Admin opens create or edit dialog.
2. Form fields vary by role.
3. Admin may choose academic tracks and related subjects.
4. Submission calls:
   - `createSupabaseAdminUser(...)`
   - `updateSupabaseAdminUser(...)`
5. Corresponding Edge Functions update auth and profile records.

### Data Written
- `auth.users`
- `profiles`
- `teacher_departments` when relevant
- subject enrollment mappings where applicable through academic data actions

## 4. Admin Manages Subjects

### Entry Point
- `src/pages/admin/AdminSubjects.tsx`
- Route: `/admin/subjects`

### Flow
1. Admin creates or edits a subject record.
2. Subject metadata includes code, names, department, level, semester, status.
3. The context writes the subject through Supabase data helpers.
4. Subject deletion uses the `admin-delete-subject` Edge Function with dependency checks.

## 5. Teacher Creates an Assignment

### Entry Point
- `src/pages/teacher/TeacherCreateAssignment.tsx`
- Route: `/teacher/create-assignment`

### Flow
1. Teacher chooses a subject from teacher-linked subjects only.
2. Teacher fills title, description, instructions, due date/time, resubmission policy, max submissions, allowed formats, and attachments.
3. Teacher saves draft or publishes.
4. `AcademicDataContext.createAssignment(...)` orchestrates the mutation.
5. `src/lib/supabase-app.ts` writes the assignment and uploads attachment files if present.

### Data Written
- `assignments`
- `assignment-attachments` bucket
- activity logs through DB triggers when configured

## 6. Student Views Assignments

### Entry Point
- `src/pages/student/StudentAssignments.tsx`
- Route: `/student/assignments`

### Flow
1. The page requests student-accessible assignments from the academic context.
2. Access is filtered through assignment visibility logic.
3. Student can search, filter, and navigate to upload or follow-up pages.

### Access Logic
- explicit `student_subjects` enrollment if present
- fallback scope by department/level/semester if no subject enrollments exist for that subject

## 7. Student Uploads a Submission

### Entry Point
- `src/pages/student/StudentUpload.tsx`
- Route: `/student/upload`

### Flow
1. Student selects an assignment.
2. File validation checks extension, size, and allowed format policy.
3. File is uploaded to `student-submissions` bucket in Supabase mode.
4. Submission record is created or updated.
5. If system settings enable automatic analysis, analysis is requested.

### Data Written
- `student-submissions` storage bucket
- `submissions`

## 8. Originality Analysis Flow

### Trigger Points
- automatic after upload when enabled
- manual teacher trigger from submission/review screens

### Runtime Path
1. Frontend calls an analysis request helper in `src/lib/supabase-app.ts`.
2. Edge Function `analyze-submission` is invoked.
3. The function fetches metadata, downloads the file, extracts text, finds internal candidate matches, sends structured context to Gemini, then persists the result.

### Data Read/Write
- reads `submissions`, `assignments`, `profiles`, `subjects`
- reads from `student-submissions`
- writes `originality_checks`
- writes `submission_matches`
- updates `submissions`

## 9. Teacher Reviews a Submission

### Entry Point
- `src/pages/teacher/TeacherReview.tsx`
- Route: `/teacher/review`

### Flow
1. Teacher opens a specific submission.
2. Screen displays metadata, originality summary, suspicious passages, internal matches, and review state.
3. Teacher chooses a decision, sets grade and comments.
4. `reviewSubmission(...)` persists the review.

### Data Written
- `reviews`
- submission review fields/state

## 10. Student Follows Up After Submission

### Entry Points
- `/student/status`
- `/student/originality`
- `/student/grades`
- `/student/history`
- `/student/calendar`

### Flow
1. Student reviews timeline/state.
2. Student checks originality summary.
3. Student checks grading result.
4. Student browses previous submissions.
5. Student uses the calendar for time-based follow-up.

### Data Read
- `submissions`
- `assignments`
- `reviews`
- `originality_checks`

## 11. Teacher Submission Inbox Workflow

### Entry Point
- `src/pages/teacher/TeacherSubmissions.tsx`
- Route: `/teacher/submissions`

### Flow
1. Teacher opens the inbox of submissions tied to teacher-owned assignments.
2. Teacher filters/searches submissions.
3. Teacher may open review, trigger analysis, or retry analysis.
4. Submission state refreshes after polling/manual refresh.

## 12. Notification Flow

### Entry Points
- header bell
- `/notifications`
- `/settings`

### Flow
1. `use-notifications.ts` derives notifications from role-specific academic data.
2. User preferences from `user-preferences.ts` influence which categories appear.
3. In Supabase mode, read-state is synced via `notification_reads`.
4. The notifications screen and header show unread counts and items.

## 13. Teacher Reports / Suspicious Cases Flow

### Entry Point
- `src/pages/teacher/TeacherReports.tsx`
- Route: `/teacher/reports`

### Flow
1. Page aggregates suspicious/high-risk teacher-visible submissions.
2. User can filter by review/analysis/risk categories.
3. User can export report views.
4. User can move to detailed review.

### Important Note
This page consumes analysis results. It does not perform analysis itself.

## 14. Admin Activity and Monitoring Flow

### Entry Points
- `src/pages/admin/AdminActivity.tsx`
- `src/pages/admin/AdminReports.tsx`
- `src/pages/admin/AdminDashboard.tsx`

### Flow
1. Admin views system-level summaries.
2. Activity feed is read from `activity_logs` when available, otherwise derived from live data.
3. Admin can inspect originality-related system-wide cases and reports.

## Final Assessment

### Confirmed from code
The major user flows coherently connect:

- frontend screens
- React context orchestration
- Supabase tables and storage
- Edge Functions
- Gemini-powered originality analysis

The architecture is workflow-oriented and largely centered on assignment lifecycle management across student, teacher, and admin roles.
