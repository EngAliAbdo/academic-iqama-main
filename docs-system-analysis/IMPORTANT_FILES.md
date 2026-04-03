# IMPORTANT_FILES

## Purpose
This file lists the most important repository files for understanding the system quickly and correctly.

## Ranking

### 1. `src/App.tsx`
Why it matters:

- Main application composition
- Declares route groups
- Declares the three role-based app areas
- Shows the global provider stack

### 2. `src/contexts/AuthContext.tsx`
Why it matters:

- Central authentication/session controller
- Switches between local mode and Supabase mode
- Handles sign-in, sign-out, password change, session sync

### 3. `src/contexts/AcademicDataContext.tsx`
Why it matters:

- Main application data orchestrator
- Converts lower-level service calls into UI-ready operations
- Exposes nearly all business actions used by pages

### 4. `src/lib/supabase-app.ts`
Why it matters:

- Largest frontend backend-integration layer
- Contains Supabase reads, writes, storage logic, function invocation, and helper queries

### 5. `src/lib/academic-data.ts`
Why it matters:

- Core domain model and transformation logic
- Defines submission/originality/review state interpretation

### 6. `src/components/AuthRoutes.tsx`
Why it matters:

- Route security
- role restriction
- must-change-password enforcement

### 7. `src/lib/auth.ts`
Why it matters:

- Demo accounts and local-mode identity helpers
- role home resolution
- local auth storage model

### 8. `src/integrations/supabase/client.ts`
Why it matters:

- Creates the frontend Supabase client
- shows auth persistence configuration

### 9. `src/hooks/use-notifications.ts`
Why it matters:

- Central notification generation logic for all roles
- connects user preferences and read-state

### 10. `src/pages/teacher/TeacherReview.tsx`
Why it matters:

- Most complex teacher-side operational page
- merges AI evidence, document preview, grading, and decisioning

### 11. `src/pages/admin/AdminUsers.tsx`
Why it matters:

- Main admin CRUD surface for identity management

### 12. `src/lib/admin-user-api.ts`
Why it matters:

- Dedicated wrapper for admin Edge Function calls

### 13. `supabase/functions/analyze-submission/index.ts`
Why it matters:

- Core AI/originality function
- file extraction, internal similarity candidate selection, Gemini integration, and persistence

### 14. `supabase/functions/admin-create-user/index.ts`
Why it matters:

- Creates auth and profile records under admin authorization

### 15. `supabase/functions/admin-update-user/index.ts`
Why it matters:

- Updates user identity/profile state with validation and department maintenance

### 16. `supabase/functions/admin-delete-user/index.ts`
Why it matters:

- Destructive admin workflow with self-delete and last-admin protections

### 17. `supabase/functions/admin-delete-subject/index.ts`
Why it matters:

- Safe subject deletion path with dependency checks

### 18. `supabase/migrations/202603220001_initial_schema.sql`
Why it matters:

- Original relational foundation

### 19. `supabase/migrations/202603230001_originality_v1_foundation.sql`
Why it matters:

- Major schema expansion for originality, reviews, and subject mapping

### 20. `supabase/migrations/202603230004_assignment_scope_rls.sql`
Why it matters:

- Central access-control migration for student assignment visibility

### 21. `supabase/migrations/202603230006_system_settings.sql`
Why it matters:

- Introduces persistent upload/analysis/system settings

### 22. `supabase/migrations/202603260002_notification_reads.sql`
Why it matters:

- Implements persisted notification read-state

### 23. `supabase/migrations/202603260003_student_subject_enrollments.sql`
Why it matters:

- Introduces explicit student-to-subject enrollment

### 24. `supabase/migrations/202603280001_remove_sections_and_word_protection.sql`
Why it matters:

- Final cleanup for removed section scoping and unused word-protection flag

### 25. `supabase/config.toml`
Why it matters:

- Edge Function deployment/runtime configuration

## Recommended Reading Order

1. `src/App.tsx`
2. `src/contexts/AuthContext.tsx`
3. `src/components/AuthRoutes.tsx`
4. `src/contexts/AcademicDataContext.tsx`
5. `src/lib/supabase-app.ts`
6. `src/lib/academic-data.ts`
7. role-specific pages in `src/pages/`
8. `supabase/functions/analyze-submission/index.ts`
9. admin Edge Functions
10. migrations under `supabase/migrations/`

## Final Note

If only one file can be studied to understand the business runtime, use `src/contexts/AcademicDataContext.tsx`.

If only one file can be studied to understand the backend integration runtime, use `src/lib/supabase-app.ts`.

If only one file can be studied to understand the AI/originality subsystem, use `supabase/functions/analyze-submission/index.ts`.
