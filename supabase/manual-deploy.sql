-- Supabase manual deployment bundle
-- Generated from checked-in migrations.
-- Run this file in Supabase SQL Editor only when CLI-based db push is unavailable.
-- Source directory: supabase/migrations

-- ============================================================================
-- Migration: 202603220001_initial_schema.sql
-- Source: supabase/migrations/202603220001_initial_schema.sql
-- ============================================================================
create extension if not exists pgcrypto;

create type public.user_role as enum ('student', 'teacher', 'admin');
create type public.assignment_status as enum ('draft', 'published', 'closed');
create type public.submission_status as enum ('submitted', 'review', 'revision', 'graded', 'accepted', 'rejected', 'flagged');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  academic_id text not null unique,
  email text not null unique,
  full_name text not null,
  role public.user_role not null default 'student',
  department text not null default '',
  role_title text not null default '',
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  teacher_name text not null,
  level text not null,
  due_at timestamptz not null,
  description text not null default '',
  instructions text not null default '',
  allowed_formats text[] not null default array[]::text[],
  max_submissions integer not null default 1,
  has_attachment boolean not null default false,
  status public.assignment_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  student_name text not null,
  academic_id text not null,
  file_name text not null,
  file_size text not null default '',
  notes text not null default '',
  submitted_at timestamptz not null default now(),
  originality integer not null default 0 check (originality >= 0 and originality <= 100),
  status public.submission_status not null default 'submitted',
  grade integer check (grade is null or (grade >= 0 and grade <= 100)),
  feedback text not null default '',
  semester text not null default '',
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.handle_updated_at();

create trigger assignments_set_updated_at
before update on public.assignments
for each row execute function public.handle_updated_at();

create trigger submissions_set_updated_at
before update on public.submissions
for each row execute function public.handle_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    academic_id,
    email,
    full_name,
    role,
    department,
    role_title,
    must_change_password
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'academic_id', new.email),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'student'),
    coalesce(new.raw_user_meta_data ->> 'department', ''),
    coalesce(new.raw_user_meta_data ->> 'role_title', ''),
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
  )
);

create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
  )
)
with check (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
  )
);

create policy "assignments_select_published_or_owner_or_admin"
on public.assignments
for select
to authenticated
using (
  status = 'published'
  or teacher_id = auth.uid()
  or exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
  )
);

create policy "assignments_insert_teacher_or_admin"
on public.assignments
for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.profiles actor_profile
    where actor_profile.id = auth.uid() and actor_profile.role in ('teacher', 'admin')
  )
);

create policy "assignments_update_owner_or_admin"
on public.assignments
for update
to authenticated
using (
  teacher_id = auth.uid()
  or exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
  )
)
with check (
  teacher_id = auth.uid()
  or exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
  )
);

create policy "submissions_select_owner_teacher_or_admin"
on public.submissions
for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.assignments assignment
    where assignment.id = submissions.assignment_id and assignment.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
  )
);

create policy "submissions_insert_owner"
on public.submissions
for insert
to authenticated
with check (student_id = auth.uid());

create policy "submissions_update_owner_teacher_or_admin"
on public.submissions
for update
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.assignments assignment
    where assignment.id = submissions.assignment_id and assignment.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
  )
)
with check (
  student_id = auth.uid()
  or exists (
    select 1
    from public.assignments assignment
    where assignment.id = submissions.assignment_id and assignment.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
  )
);


-- ============================================================================
-- Migration: 202603230001_originality_v1_foundation.sql
-- Source: supabase/migrations/202603230001_originality_v1_foundation.sql
-- ============================================================================
create type public.analysis_status as enum ('pending', 'processing', 'completed', 'failed', 'manual_review_required');
create type public.risk_level as enum ('low', 'medium', 'high');
create type public.originality_recommended_status as enum ('clean', 'review', 'flagged');
create type public.review_final_decision as enum ('accepted', 'rejected', 'revision');
create type public.match_type as enum ('literal', 'paraphrased', 'common_overlap', 'citation_overlap');
create type public.match_source_scope as enum ('same_assignment', 'same_subject', 'same_level_semester');

alter table public.profiles
  add column if not exists full_name_ar text not null default '',
  add column if not exists full_name_en text not null default '',
  add column if not exists employee_number text,
  add column if not exists level text not null default '',
  add column if not exists semester text not null default '',
  add column if not exists first_login boolean not null default false,
  add column if not exists default_password_flag boolean not null default false;

update public.profiles
set
  full_name_ar = case when full_name_ar = '' then full_name else full_name_ar end,
  first_login = coalesce(first_login, must_change_password),
  default_password_flag = coalesce(default_password_flag, must_change_password);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null default '',
  code text not null default '',
  department text not null default '',
  level text not null default '',
  semester text not null default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teacher_subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  department text not null default '',
  level text not null default '',
  semester text not null default '',
  created_at timestamptz not null default now(),
  unique (teacher_id, subject_id)
);

create table public.teacher_departments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  department text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, department)
);

alter table public.assignments
  add column if not exists subject_id uuid references public.subjects (id) on delete set null,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists due_time time,
  add column if not exists resubmission_policy text not null default 'replace_latest',
  add column if not exists word_protection_enabled boolean not null default false;

update public.assignments
set due_time = coalesce(due_time, due_at::time);

alter table public.submissions
  add column if not exists file_path text,
  add column if not exists file_mime_type text not null default '',
  add column if not exists analysis_status public.analysis_status not null default 'pending',
  add column if not exists analysis_requested_at timestamptz,
  add column if not exists analysis_completed_at timestamptz,
  add column if not exists analysis_error text not null default '';

update public.submissions
set
  analysis_status = case
    when originality > 0 then 'completed'::public.analysis_status
    else analysis_status
  end,
  analysis_requested_at = coalesce(analysis_requested_at, submitted_at),
  analysis_completed_at = case
    when originality > 0 then coalesce(analysis_completed_at, submitted_at)
    else analysis_completed_at
  end;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  comments text not null default '',
  final_decision public.review_final_decision,
  reviewed_at timestamptz,
  manual_evaluation jsonb not null default '{}'::jsonb,
  appeal_status text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.originality_checks (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  originality_score integer not null default 0 check (originality_score >= 0 and originality_score <= 100),
  matching_percentage integer not null default 0 check (matching_percentage >= 0 and matching_percentage <= 100),
  risk_level public.risk_level not null default 'low',
  recommended_status public.originality_recommended_status not null default 'review',
  summary_for_teacher text not null default '',
  summary_for_student text not null default '',
  summary_for_admin text not null default '',
  confidence_score integer not null default 0 check (confidence_score >= 0 and confidence_score <= 100),
  reasoning_notes jsonb not null default '[]'::jsonb,
  suspicious_sections jsonb not null default '[]'::jsonb,
  analysis_status public.analysis_status not null default 'pending',
  model_name text not null default '',
  prompt_version text not null default 'v1',
  raw_response jsonb not null default '{}'::jsonb,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.submission_matches (
  id uuid primary key default gen_random_uuid(),
  originality_check_id uuid not null references public.originality_checks (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  matched_submission_id uuid references public.submissions (id) on delete set null,
  matched_student_id uuid references public.profiles (id) on delete set null,
  matched_student_name text not null default '',
  matched_assignment_id uuid references public.assignments (id) on delete set null,
  matched_subject_id uuid references public.subjects (id) on delete set null,
  similarity_score integer not null default 0 check (similarity_score >= 0 and similarity_score <= 100),
  match_type public.match_type not null default 'literal',
  matched_excerpt text not null default '',
  section_text text not null default '',
  source_scope public.match_source_scope not null default 'same_assignment',
  rank_order integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.submissions
  add column if not exists latest_originality_check_id uuid references public.originality_checks (id) on delete set null;

create index assignments_subject_id_idx on public.assignments (subject_id);
create index submissions_assignment_analysis_idx on public.submissions (assignment_id, analysis_status);
create index submissions_student_analysis_idx on public.submissions (student_id, analysis_status);
create index originality_checks_submission_idx on public.originality_checks (submission_id, analyzed_at desc);
create index originality_checks_risk_idx on public.originality_checks (risk_level, analysis_status);
create index submission_matches_submission_idx on public.submission_matches (submission_id, rank_order);
create index submission_matches_check_idx on public.submission_matches (originality_check_id, similarity_score desc);

create trigger subjects_set_updated_at
before update on public.subjects
for each row execute function public.handle_updated_at();

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.handle_updated_at();

create trigger originality_checks_set_updated_at
before update on public.originality_checks
for each row execute function public.handle_updated_at();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

create or replace function public.is_teacher_for_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments
    where id = target_assignment_id
      and teacher_id = auth.uid()
  )
$$;

create or replace function public.is_submission_owner(target_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.submissions
    where id = target_submission_id
      and student_id = auth.uid()
  )
$$;

create or replace function public.can_manage_submission(target_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.submissions submission
    join public.assignments assignment on assignment.id = submission.assignment_id
    where submission.id = target_submission_id
      and (
        assignment.teacher_id = auth.uid()
        or public.is_admin()
      )
  )
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    academic_id,
    email,
    full_name,
    full_name_ar,
    full_name_en,
    employee_number,
    role,
    department,
    role_title,
    level,
    semester,
    must_change_password,
    first_login,
    default_password_flag
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'academic_id', new.email),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name_ar', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name_en', ''),
    nullif(new.raw_user_meta_data ->> 'employee_number', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'student'),
    coalesce(new.raw_user_meta_data ->> 'department', ''),
    coalesce(new.raw_user_meta_data ->> 'role_title', ''),
    coalesce(new.raw_user_meta_data ->> 'level', ''),
    coalesce(new.raw_user_meta_data ->> 'semester', ''),
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'first_login')::boolean, coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false)),
    coalesce((new.raw_user_meta_data ->> 'default_password_flag')::boolean, coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

alter table public.subjects enable row level security;
alter table public.teacher_subjects enable row level security;
alter table public.teacher_departments enable row level security;
alter table public.reviews enable row level security;
alter table public.originality_checks enable row level security;
alter table public.submission_matches enable row level security;

create policy "subjects_select_authenticated"
on public.subjects
for select
to authenticated
using (true);

create policy "subjects_manage_admin"
on public.subjects
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "teacher_subjects_select_self_or_admin"
on public.teacher_subjects
for select
to authenticated
using (teacher_id = auth.uid() or public.is_admin());

create policy "teacher_subjects_manage_admin"
on public.teacher_subjects
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "teacher_departments_select_self_or_admin"
on public.teacher_departments
for select
to authenticated
using (teacher_id = auth.uid() or public.is_admin());

create policy "teacher_departments_manage_admin"
on public.teacher_departments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "reviews_select_owner_teacher_or_admin"
on public.reviews
for select
to authenticated
using (
  public.is_submission_owner(submission_id)
  or public.can_manage_submission(submission_id)
);

create policy "reviews_insert_teacher_or_admin"
on public.reviews
for insert
to authenticated
with check (
  public.can_manage_submission(submission_id)
  and (
    teacher_id = auth.uid()
    or public.is_admin()
  )
);

create policy "reviews_update_teacher_or_admin"
on public.reviews
for update
to authenticated
using (public.can_manage_submission(submission_id))
with check (public.can_manage_submission(submission_id));

create policy "originality_checks_select_owner_teacher_or_admin"
on public.originality_checks
for select
to authenticated
using (
  public.is_submission_owner(submission_id)
  or public.can_manage_submission(submission_id)
);

create policy "originality_checks_manage_admin"
on public.originality_checks
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "submission_matches_select_teacher_or_admin"
on public.submission_matches
for select
to authenticated
using (
  public.can_manage_submission(submission_id)
  or public.is_admin()
);

create policy "submission_matches_manage_admin"
on public.submission_matches
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values
  (
    'assignment-attachments',
    'assignment-attachments',
    false,
    array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    10485760
  ),
  (
    'student-submissions',
    'student-submissions',
    false,
    array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    10485760
  )
on conflict (id) do nothing;

create policy "assignment_attachments_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'assignment-attachments');

create policy "assignment_attachments_insert_teacher_or_admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'assignment-attachments'
  and public.current_user_role() in ('teacher', 'admin')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "assignment_attachments_update_owner_or_admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'assignment-attachments'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
)
with check (
  bucket_id = 'assignment-attachments'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy "assignment_attachments_delete_owner_or_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'assignment-attachments'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy "student_submissions_select_owner_teacher_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-submissions'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (
      select 1
      from public.submissions submission
      join public.assignments assignment on assignment.id = submission.assignment_id
      where submission.file_path = name
        and assignment.teacher_id = auth.uid()
    )
  )
);

create policy "student_submissions_insert_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-submissions'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "student_submissions_update_owner_or_admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'student-submissions'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
)
with check (
  bucket_id = 'student-submissions'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

create policy "student_submissions_delete_owner_or_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'student-submissions'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);


-- ============================================================================
-- Migration: 202603230002_auth_identifier_login.sql
-- Source: supabase/migrations/202603230002_auth_identifier_login.sql
-- ============================================================================
create or replace function public.resolve_login_identifier(lookup_identifier text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select profile.email
  from public.profiles as profile
  where lower(profile.email) = lower(trim(lookup_identifier))
    or lower(profile.academic_id) = lower(trim(lookup_identifier))
    or lower(coalesce(profile.employee_number, '')) = lower(trim(lookup_identifier))
  order by
    case
      when lower(profile.email) = lower(trim(lookup_identifier)) then 1
      when lower(profile.academic_id) = lower(trim(lookup_identifier)) then 2
      when lower(coalesce(profile.employee_number, '')) = lower(trim(lookup_identifier)) then 3
      else 4
    end
  limit 1
$$;

revoke all on function public.resolve_login_identifier(text) from public;
grant execute on function public.resolve_login_identifier(text) to anon;
grant execute on function public.resolve_login_identifier(text) to authenticated;


-- ============================================================================
-- Migration: 202603230003_accessible_originality_checks.sql
-- Source: supabase/migrations/202603230003_accessible_originality_checks.sql
-- ============================================================================
drop policy if exists "originality_checks_select_owner_teacher_or_admin"
on public.originality_checks;

create policy "originality_checks_select_teacher_or_admin"
on public.originality_checks
for select
to authenticated
using (public.can_manage_submission(submission_id));

create or replace function public.get_accessible_originality_checks()
returns table (
  id uuid,
  submission_id uuid,
  originality_score integer,
  matching_percentage integer,
  risk_level public.risk_level,
  recommended_status public.originality_recommended_status,
  summary_for_teacher text,
  summary_for_student text,
  summary_for_admin text,
  confidence_score integer,
  reasoning_notes jsonb,
  suspicious_sections jsonb,
  analysis_status public.analysis_status,
  model_name text,
  prompt_version text,
  raw_response jsonb,
  analyzed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with actor as (
    select public.current_user_role() as role
  )
  select
    check_row.id,
    check_row.submission_id,
    check_row.originality_score,
    check_row.matching_percentage,
    check_row.risk_level,
    check_row.recommended_status,
    case
      when actor.role in ('teacher', 'admin') then check_row.summary_for_teacher
      else ''
    end as summary_for_teacher,
    check_row.summary_for_student,
    case
      when actor.role in ('teacher', 'admin') then check_row.summary_for_admin
      else ''
    end as summary_for_admin,
    check_row.confidence_score,
    case
      when actor.role in ('teacher', 'admin') then check_row.reasoning_notes
      else '[]'::jsonb
    end as reasoning_notes,
    case
      when actor.role in ('teacher', 'admin') then check_row.suspicious_sections
      else '[]'::jsonb
    end as suspicious_sections,
    check_row.analysis_status,
    check_row.model_name,
    check_row.prompt_version,
    case
      when actor.role in ('teacher', 'admin') then check_row.raw_response
      else '{}'::jsonb
    end as raw_response,
    check_row.analyzed_at,
    check_row.created_at,
    check_row.updated_at
  from public.originality_checks as check_row
  cross join actor
  where (
    actor.role = 'student'
    and public.is_submission_owner(check_row.submission_id)
  ) or (
    actor.role in ('teacher', 'admin')
    and public.can_manage_submission(check_row.submission_id)
  )
  order by
    check_row.analyzed_at desc nulls last,
    check_row.created_at desc;
$$;

revoke all on function public.get_accessible_originality_checks() from public;
grant execute on function public.get_accessible_originality_checks() to authenticated;


-- ============================================================================
-- Migration: 202603230004_assignment_scope_rls.sql
-- Source: supabase/migrations/202603230004_assignment_scope_rls.sql
-- ============================================================================
create or replace function public.can_student_access_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments assignment
    join public.profiles student_profile on student_profile.id = auth.uid()
    left join public.subjects subject on subject.id = assignment.subject_id
    where assignment.id = target_assignment_id
      and student_profile.role = 'student'
      and assignment.status = 'published'
      and (
        coalesce(assignment.level, '') = ''
        or coalesce(student_profile.level, '') = ''
        or assignment.level = student_profile.level
      )
      and (
        assignment.subject_id is null
        or (
          (
            coalesce(subject.department, '') = ''
            or coalesce(student_profile.department, '') = ''
            or subject.department = student_profile.department
          )
          and (
            coalesce(subject.level, '') = ''
            or coalesce(student_profile.level, '') = ''
            or subject.level = student_profile.level
          )
          and (
            coalesce(subject.semester, '') = ''
            or coalesce(student_profile.semester, '') = ''
            or subject.semester = student_profile.semester
          )
        )
      )
  )
$$;

drop policy if exists "assignments_select_published_or_owner_or_admin"
on public.assignments;

create policy "assignments_select_relevant_or_owner_or_admin"
on public.assignments
for select
to authenticated
using (
  public.can_student_access_assignment(id)
  or teacher_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "submissions_insert_owner"
on public.submissions;

create policy "submissions_insert_owner_for_accessible_assignment"
on public.submissions
for insert
to authenticated
with check (
  student_id = auth.uid()
  and public.can_student_access_assignment(assignment_id)
);

drop policy if exists "submissions_update_owner_teacher_or_admin"
on public.submissions;

create policy "submissions_update_owner_teacher_or_admin"
on public.submissions
for update
to authenticated
using (
  student_id = auth.uid()
  or public.can_manage_submission(id)
)
with check (
  (
    student_id = auth.uid()
    and public.can_student_access_assignment(assignment_id)
  )
  or public.can_manage_submission(id)
);


-- ============================================================================
-- Migration: 202603230005_activity_logs.sql
-- Source: supabase/migrations/202603230005_activity_logs.sql
-- ============================================================================
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null default '',
  actor_role text not null default 'system'
    check (actor_role in ('student', 'teacher', 'admin', 'system')),
  action text not null default '',
  details text not null default '',
  category text not null default 'analysis'
    check (category in ('assignment', 'submission', 'analysis', 'review')),
  status_label text not null default '',
  status_variant text not null default 'review'
    check (status_variant in ('draft', 'published', 'submitted', 'review', 'revision', 'graded', 'accepted', 'rejected', 'flagged', 'closed')),
  priority text not null default 'normal'
    check (priority in ('normal', 'attention', 'critical')),
  entity_type text not null default '',
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_occurred_at_idx
  on public.activity_logs (occurred_at desc);

create index if not exists activity_logs_category_idx
  on public.activity_logs (category, occurred_at desc);

create index if not exists activity_logs_priority_idx
  on public.activity_logs (priority, occurred_at desc);

create or replace function public.record_activity_log(
  target_actor_id uuid,
  target_actor_name text,
  target_actor_role text,
  target_action text,
  target_details text,
  target_category text,
  target_status_label text,
  target_status_variant text,
  target_priority text,
  target_entity_type text,
  target_entity_id uuid,
  target_metadata jsonb default '{}'::jsonb,
  target_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_logs (
    actor_id,
    actor_name,
    actor_role,
    action,
    details,
    category,
    status_label,
    status_variant,
    priority,
    entity_type,
    entity_id,
    metadata,
    occurred_at
  )
  values (
    target_actor_id,
    coalesce(nullif(target_actor_name, ''), 'النظام'),
    case
      when target_actor_role in ('student', 'teacher', 'admin', 'system') then target_actor_role
      else 'system'
    end,
    coalesce(target_action, ''),
    coalesce(target_details, ''),
    case
      when target_category in ('assignment', 'submission', 'analysis', 'review') then target_category
      else 'analysis'
    end,
    coalesce(target_status_label, ''),
    case
      when target_status_variant in ('draft', 'published', 'submitted', 'review', 'revision', 'graded', 'accepted', 'rejected', 'flagged', 'closed') then target_status_variant
      else 'review'
    end,
    case
      when target_priority in ('normal', 'attention', 'critical') then target_priority
      else 'normal'
    end,
    coalesce(target_entity_type, ''),
    target_entity_id,
    coalesce(target_metadata, '{}'::jsonb),
    coalesce(target_occurred_at, now())
  );
end;
$$;

create or replace function public.log_assignment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.record_activity_log(
    new.teacher_id,
    new.teacher_name,
    'teacher',
    'أنشأ تكليفاً',
    concat(new.title, ' - ', new.subject),
    'assignment',
    case
      when new.status = 'draft' then 'مسودة'
      when new.status = 'closed' then 'مغلق'
      else 'منشور'
    end,
    case
      when new.status = 'draft' then 'draft'
      when new.status = 'closed' then 'closed'
      else 'published'
    end,
    'normal',
    'assignment',
    new.id,
    jsonb_build_object(
      'subject', new.subject,
      'level', new.level,
      'status', new.status
    ),
    coalesce(new.created_at, now())
  );

  return new;
end;
$$;

create or replace function public.log_submission_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_title text := '';
begin
  select title
  into assignment_title
  from public.assignments
  where id = new.assignment_id;

  perform public.record_activity_log(
    new.student_id,
    new.student_name,
    'student',
    'رفع تسليماً',
    concat(coalesce(assignment_title, 'تكليف'), ' - ', new.file_name),
    'submission',
    'تم الرفع',
    'submitted',
    'normal',
    'submission',
    new.id,
    jsonb_build_object(
      'assignment_id', new.assignment_id,
      'analysis_status', new.analysis_status,
      'file_name', new.file_name
    ),
    coalesce(new.submitted_at, now())
  );

  return new;
end;
$$;

create or replace function public.log_originality_check_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_row public.submissions%rowtype;
  assignment_row public.assignments%rowtype;
  action_text text := 'اكتمل تحليل الأصالة';
  details_text text := '';
  status_label_text text := 'منخفضة';
  status_variant_text text := 'accepted';
  priority_text text := 'normal';
begin
  select *
  into submission_row
  from public.submissions
  where id = new.submission_id;

  if submission_row.id is null then
    return new;
  end if;

  select *
  into assignment_row
  from public.assignments
  where id = submission_row.assignment_id;

  if new.analysis_status = 'manual_review_required' then
    action_text := 'حوّل الحالة إلى مراجعة يدوية';
    status_label_text := 'مراجعة يدوية';
    status_variant_text := 'revision';
    priority_text := 'attention';
  elsif new.analysis_status = 'failed' then
    action_text := 'فشل تحليل الأصالة';
    status_label_text := 'فشل التحليل';
    status_variant_text := 'rejected';
    priority_text := 'attention';
  elsif new.risk_level = 'high' then
    action_text := 'اكتمل التحليل مع اشتباه مرتفع';
    status_label_text := 'خطورة مرتفعة';
    status_variant_text := 'flagged';
    priority_text := 'critical';
  elsif new.risk_level = 'medium' then
    action_text := 'اكتمل التحليل ويحتاج متابعة';
    status_label_text := 'خطورة متوسطة';
    status_variant_text := 'review';
    priority_text := 'attention';
  else
    status_label_text := 'خطورة منخفضة';
    status_variant_text := 'accepted';
  end if;

  details_text := concat(
    coalesce(assignment_row.title, 'تكليف'),
    ' - ',
    submission_row.student_name,
    ' - أصالة ',
    new.originality_score,
    '%'
  );

  perform public.record_activity_log(
    null,
    'النظام',
    'system',
    action_text,
    details_text,
    'analysis',
    status_label_text,
    status_variant_text,
    priority_text,
    'originality_check',
    new.id,
    jsonb_build_object(
      'submission_id', new.submission_id,
      'risk_level', new.risk_level,
      'recommended_status', new.recommended_status,
      'matching_percentage', new.matching_percentage
    ),
    coalesce(new.analyzed_at, new.created_at, now())
  );

  return new;
end;
$$;

create or replace function public.log_review_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_row public.submissions%rowtype;
  assignment_row public.assignments%rowtype;
  teacher_name text := 'المعلم';
  decision_label text := 'قيد المراجعة';
  status_variant_text text := 'review';
  priority_text text := 'normal';
  grade_value text := '';
begin
  if tg_op = 'UPDATE'
    and row(new.comments, new.final_decision, new.reviewed_at, new.manual_evaluation)
      is not distinct from row(old.comments, old.final_decision, old.reviewed_at, old.manual_evaluation) then
    return new;
  end if;

  select *
  into submission_row
  from public.submissions
  where id = new.submission_id;

  if submission_row.id is null then
    return new;
  end if;

  select *
  into assignment_row
  from public.assignments
  where id = submission_row.assignment_id;

  select coalesce(full_name_ar, full_name, 'المعلم')
  into teacher_name
  from public.profiles
  where id = new.teacher_id;

  if new.final_decision = 'accepted' then
    decision_label := 'مقبول';
    status_variant_text := 'accepted';
  elsif new.final_decision = 'rejected' then
    decision_label := 'غير مقبول';
    status_variant_text := 'rejected';
    priority_text := 'attention';
  elsif new.final_decision = 'revision' then
    decision_label := 'يحتاج تعديل';
    status_variant_text := 'revision';
    priority_text := 'attention';
  elsif (new.manual_evaluation ->> 'grade') is not null then
    decision_label := 'تم التقييم';
    status_variant_text := 'graded';
  end if;

  if (new.manual_evaluation ->> 'grade') is not null then
    grade_value := concat(' - الدرجة ', new.manual_evaluation ->> 'grade');
  end if;

  perform public.record_activity_log(
    new.teacher_id,
    teacher_name,
    'teacher',
    case
      when new.final_decision is null then 'سجل ملاحظات التقييم'
      else 'أصدر قرار المراجعة'
    end,
    concat(
      submission_row.student_name,
      ' - ',
      coalesce(assignment_row.title, 'تكليف'),
      ' - ',
      decision_label,
      grade_value
    ),
    'review',
    decision_label,
    status_variant_text,
    priority_text,
    'review',
    new.id,
    jsonb_build_object(
      'submission_id', new.submission_id,
      'final_decision', new.final_decision,
      'appeal_status', new.appeal_status
    ),
    coalesce(new.reviewed_at, new.updated_at, now())
  );

  return new;
end;
$$;

drop trigger if exists activity_logs_on_assignment_insert on public.assignments;
create trigger activity_logs_on_assignment_insert
after insert on public.assignments
for each row execute function public.log_assignment_activity();

drop trigger if exists activity_logs_on_submission_insert on public.submissions;
create trigger activity_logs_on_submission_insert
after insert on public.submissions
for each row execute function public.log_submission_activity();

drop trigger if exists activity_logs_on_originality_check_insert on public.originality_checks;
create trigger activity_logs_on_originality_check_insert
after insert on public.originality_checks
for each row execute function public.log_originality_check_activity();

drop trigger if exists activity_logs_on_review_write on public.reviews;
create trigger activity_logs_on_review_write
after insert or update on public.reviews
for each row execute function public.log_review_activity();

insert into public.activity_logs (
  actor_id,
  actor_name,
  actor_role,
  action,
  details,
  category,
  status_label,
  status_variant,
  priority,
  entity_type,
  entity_id,
  metadata,
  occurred_at
)
select
  assignment.teacher_id,
  coalesce(profile.full_name_ar, profile.full_name, assignment.teacher_name),
  'teacher',
  'أنشأ تكليفاً',
  concat(assignment.title, ' - ', assignment.subject),
  'assignment',
  case
    when assignment.status = 'draft' then 'مسودة'
    when assignment.status = 'closed' then 'مغلق'
    else 'منشور'
  end,
  case
    when assignment.status = 'draft' then 'draft'
    when assignment.status = 'closed' then 'closed'
    else 'published'
  end,
  'normal',
  'assignment',
  assignment.id,
  jsonb_build_object(
    'subject', assignment.subject,
    'level', assignment.level,
    'status', assignment.status
  ),
  assignment.created_at
from public.assignments assignment
left join public.profiles profile on profile.id = assignment.teacher_id
where not exists (select 1 from public.activity_logs);

insert into public.activity_logs (
  actor_id,
  actor_name,
  actor_role,
  action,
  details,
  category,
  status_label,
  status_variant,
  priority,
  entity_type,
  entity_id,
  metadata,
  occurred_at
)
select
  submission.student_id,
  submission.student_name,
  'student',
  'رفع تسليماً',
  concat(coalesce(assignment.title, 'تكليف'), ' - ', submission.file_name),
  'submission',
  'تم الرفع',
  'submitted',
  'normal',
  'submission',
  submission.id,
  jsonb_build_object(
    'assignment_id', submission.assignment_id,
    'analysis_status', submission.analysis_status,
    'file_name', submission.file_name
  ),
  submission.submitted_at
from public.submissions submission
left join public.assignments assignment on assignment.id = submission.assignment_id
where not exists (
  select 1
  from public.activity_logs log
  where log.entity_type = 'submission'
);

insert into public.activity_logs (
  actor_id,
  actor_name,
  actor_role,
  action,
  details,
  category,
  status_label,
  status_variant,
  priority,
  entity_type,
  entity_id,
  metadata,
  occurred_at
)
select
  null,
  'النظام',
  'system',
  case
    when check_row.analysis_status = 'manual_review_required' then 'حوّل الحالة إلى مراجعة يدوية'
    when check_row.analysis_status = 'failed' then 'فشل تحليل الأصالة'
    when check_row.risk_level = 'high' then 'اكتمل التحليل مع اشتباه مرتفع'
    when check_row.risk_level = 'medium' then 'اكتمل التحليل ويحتاج متابعة'
    else 'اكتمل تحليل الأصالة'
  end,
  concat(
    coalesce(assignment.title, 'تكليف'),
    ' - ',
    submission.student_name,
    ' - أصالة ',
    check_row.originality_score,
    '%'
  ),
  'analysis',
  case
    when check_row.analysis_status = 'manual_review_required' then 'مراجعة يدوية'
    when check_row.analysis_status = 'failed' then 'فشل التحليل'
    when check_row.risk_level = 'high' then 'خطورة مرتفعة'
    when check_row.risk_level = 'medium' then 'خطورة متوسطة'
    else 'خطورة منخفضة'
  end,
  case
    when check_row.analysis_status = 'manual_review_required' then 'revision'
    when check_row.analysis_status = 'failed' then 'rejected'
    when check_row.risk_level = 'high' then 'flagged'
    when check_row.risk_level = 'medium' then 'review'
    else 'accepted'
  end,
  case
    when check_row.risk_level = 'high' then 'critical'
    when check_row.analysis_status in ('failed', 'manual_review_required') or check_row.risk_level = 'medium' then 'attention'
    else 'normal'
  end,
  'originality_check',
  check_row.id,
  jsonb_build_object(
    'submission_id', check_row.submission_id,
    'risk_level', check_row.risk_level,
    'recommended_status', check_row.recommended_status,
    'matching_percentage', check_row.matching_percentage
  ),
  coalesce(check_row.analyzed_at, check_row.created_at)
from public.originality_checks check_row
join public.submissions submission on submission.id = check_row.submission_id
left join public.assignments assignment on assignment.id = submission.assignment_id
where not exists (
  select 1
  from public.activity_logs log
  where log.entity_type = 'originality_check'
);

insert into public.activity_logs (
  actor_id,
  actor_name,
  actor_role,
  action,
  details,
  category,
  status_label,
  status_variant,
  priority,
  entity_type,
  entity_id,
  metadata,
  occurred_at
)
select
  review.teacher_id,
  coalesce(profile.full_name_ar, profile.full_name, assignment.teacher_name, 'المعلم'),
  'teacher',
  case
    when review.final_decision is null then 'سجل ملاحظات التقييم'
    else 'أصدر قرار المراجعة'
  end,
  concat(
    submission.student_name,
    ' - ',
    coalesce(assignment.title, 'تكليف'),
    ' - ',
    case
      when review.final_decision = 'accepted' then 'مقبول'
      when review.final_decision = 'rejected' then 'غير مقبول'
      when review.final_decision = 'revision' then 'يحتاج تعديل'
      when (review.manual_evaluation ->> 'grade') is not null then 'تم التقييم'
      else 'قيد المراجعة'
    end,
    case
      when (review.manual_evaluation ->> 'grade') is not null then concat(' - الدرجة ', review.manual_evaluation ->> 'grade')
      else ''
    end
  ),
  'review',
  case
    when review.final_decision = 'accepted' then 'مقبول'
    when review.final_decision = 'rejected' then 'غير مقبول'
    when review.final_decision = 'revision' then 'يحتاج تعديل'
    when (review.manual_evaluation ->> 'grade') is not null then 'تم التقييم'
    else 'قيد المراجعة'
  end,
  case
    when review.final_decision = 'accepted' then 'accepted'
    when review.final_decision = 'rejected' then 'rejected'
    when review.final_decision = 'revision' then 'revision'
    when (review.manual_evaluation ->> 'grade') is not null then 'graded'
    else 'review'
  end,
  case
    when review.final_decision in ('rejected', 'revision') then 'attention'
    else 'normal'
  end,
  'review',
  review.id,
  jsonb_build_object(
    'submission_id', review.submission_id,
    'final_decision', review.final_decision,
    'appeal_status', review.appeal_status
  ),
  coalesce(review.reviewed_at, review.updated_at, review.created_at)
from public.reviews review
join public.submissions submission on submission.id = review.submission_id
left join public.assignments assignment on assignment.id = submission.assignment_id
left join public.profiles profile on profile.id = review.teacher_id
where not exists (
  select 1
  from public.activity_logs log
  where log.entity_type = 'review'
);

alter table public.activity_logs enable row level security;

create policy "activity_logs_select_admin"
on public.activity_logs
for select
to authenticated
using (public.is_admin());

create policy "activity_logs_manage_admin"
on public.activity_logs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- ============================================================================
-- Migration: 202603230006_system_settings.sql
-- Source: supabase/migrations/202603230006_system_settings.sql
-- ============================================================================
create table if not exists public.system_settings (
  id boolean primary key default true check (id),
  institution_name text not null default 'جامعة المعرفة',
  academic_year text not null default '1447 هـ',
  max_upload_size_mb integer not null default 10
    check (max_upload_size_mb >= 1 and max_upload_size_mb <= 100),
  allowed_submission_formats text[] not null default array['PDF', 'DOCX']::text[]
    check (
      coalesce(array_length(allowed_submission_formats, 1), 0) > 0
      and allowed_submission_formats <@ array['PDF', 'DOCX']::text[]
    ),
  medium_risk_below integer not null default 80
    check (medium_risk_below >= 1 and medium_risk_below <= 100),
  high_risk_below integer not null default 50
    check (high_risk_below >= 1 and high_risk_below <= 99),
  suspicious_alert_below integer not null default 60
    check (suspicious_alert_below >= 1 and suspicious_alert_below <= 100),
  manual_review_on_extraction_failure boolean not null default true,
  auto_start_analysis boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (high_risk_below < medium_risk_below),
  check (suspicious_alert_below >= high_risk_below and suspicious_alert_below <= medium_risk_below)
);

create trigger system_settings_set_updated_at
before update on public.system_settings
for each row execute function public.handle_updated_at();

insert into public.system_settings (
  id,
  institution_name,
  academic_year,
  max_upload_size_mb,
  allowed_submission_formats,
  medium_risk_below,
  high_risk_below,
  suspicious_alert_below,
  manual_review_on_extraction_failure,
  auto_start_analysis
)
values (
  true,
  'جامعة المعرفة',
  '1447 هـ',
  10,
  array['PDF', 'DOCX']::text[],
  80,
  50,
  60,
  true,
  true
)
on conflict (id) do nothing;

alter table public.system_settings enable row level security;

create policy "system_settings_select_authenticated"
on public.system_settings
for select
to authenticated
using (true);

create policy "system_settings_insert_admin"
on public.system_settings
for insert
to authenticated
with check (public.is_admin());

create policy "system_settings_update_admin"
on public.system_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- ============================================================================
-- Migration: 202603230007_activity_settings_logs.sql
-- Source: supabase/migrations/202603230007_activity_settings_logs.sql
-- ============================================================================
alter table public.activity_logs
  drop constraint if exists activity_logs_category_check;

alter table public.activity_logs
  add constraint activity_logs_category_check
  check (category in ('assignment', 'submission', 'analysis', 'review', 'settings'));

create or replace function public.record_activity_log(
  target_actor_id uuid,
  target_actor_name text,
  target_actor_role text,
  target_action text,
  target_details text,
  target_category text,
  target_status_label text,
  target_status_variant text,
  target_priority text,
  target_entity_type text,
  target_entity_id uuid,
  target_metadata jsonb default '{}'::jsonb,
  target_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_logs (
    actor_id,
    actor_name,
    actor_role,
    action,
    details,
    category,
    status_label,
    status_variant,
    priority,
    entity_type,
    entity_id,
    metadata,
    occurred_at
  )
  values (
    target_actor_id,
    coalesce(nullif(target_actor_name, ''), 'النظام'),
    case
      when target_actor_role in ('student', 'teacher', 'admin', 'system') then target_actor_role
      else 'system'
    end,
    coalesce(target_action, ''),
    coalesce(target_details, ''),
    case
      when target_category in ('assignment', 'submission', 'analysis', 'review', 'settings') then target_category
      else 'analysis'
    end,
    coalesce(target_status_label, ''),
    case
      when target_status_variant in ('draft', 'published', 'submitted', 'review', 'revision', 'graded', 'accepted', 'rejected', 'flagged', 'closed') then target_status_variant
      else 'review'
    end,
    case
      when target_priority in ('normal', 'attention', 'critical') then target_priority
      else 'normal'
    end,
    coalesce(target_entity_type, ''),
    target_entity_id,
    coalesce(target_metadata, '{}'::jsonb),
    coalesce(target_occurred_at, now())
  );
end;
$$;

create or replace function public.log_system_settings_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name_value text := 'النظام';
  action_text text := 'اعتمد إعدادات النظام';
  details_text text := '';
begin
  if tg_op = 'UPDATE'
    and row(
      new.institution_name,
      new.academic_year,
      new.max_upload_size_mb,
      new.allowed_submission_formats,
      new.medium_risk_below,
      new.high_risk_below,
      new.suspicious_alert_below,
      new.manual_review_on_extraction_failure,
      new.auto_start_analysis
    ) is not distinct from row(
      old.institution_name,
      old.academic_year,
      old.max_upload_size_mb,
      old.allowed_submission_formats,
      old.medium_risk_below,
      old.high_risk_below,
      old.suspicious_alert_below,
      old.manual_review_on_extraction_failure,
      old.auto_start_analysis
    ) then
    return new;
  end if;

  if new.updated_by is not null then
    select coalesce(full_name_ar, full_name, 'مدير النظام')
    into actor_name_value
    from public.profiles
    where id = new.updated_by;
  end if;

  if tg_op = 'UPDATE' then
    action_text := 'حدّث إعدادات النظام';
  end if;

  details_text := concat(
    coalesce(new.institution_name, 'المؤسسة'),
    ' - ',
    coalesce(new.academic_year, ''),
    ' - رفع ',
    new.max_upload_size_mb,
    'MB - تنبيه ',
    new.suspicious_alert_below,
    '%'
  );

  perform public.record_activity_log(
    new.updated_by,
    actor_name_value,
    case when new.updated_by is null then 'system' else 'admin' end,
    action_text,
    details_text,
    'settings',
    case when tg_op = 'UPDATE' then 'تم التحديث' else 'إعدادات فعالة' end,
    'published',
    'normal',
    'system_settings',
    null,
    jsonb_build_object(
      'institution_name', new.institution_name,
      'academic_year', new.academic_year,
      'max_upload_size_mb', new.max_upload_size_mb,
      'allowed_submission_formats', new.allowed_submission_formats,
      'medium_risk_below', new.medium_risk_below,
      'high_risk_below', new.high_risk_below,
      'suspicious_alert_below', new.suspicious_alert_below,
      'manual_review_on_extraction_failure', new.manual_review_on_extraction_failure,
      'auto_start_analysis', new.auto_start_analysis
    ),
    coalesce(new.updated_at, now())
  );

  return new;
end;
$$;

drop trigger if exists activity_logs_on_system_settings_write on public.system_settings;
create trigger activity_logs_on_system_settings_write
after insert or update on public.system_settings
for each row execute function public.log_system_settings_activity();

insert into public.activity_logs (
  actor_id,
  actor_name,
  actor_role,
  action,
  details,
  category,
  status_label,
  status_variant,
  priority,
  entity_type,
  entity_id,
  metadata,
  occurred_at
)
select
  settings.updated_by,
  coalesce(profile.full_name_ar, profile.full_name, 'النظام'),
  case when settings.updated_by is null then 'system' else 'admin' end,
  'اعتمد إعدادات النظام',
  concat(
    settings.institution_name,
    ' - ',
    settings.academic_year,
    ' - رفع ',
    settings.max_upload_size_mb,
    'MB - تنبيه ',
    settings.suspicious_alert_below,
    '%'
  ),
  'settings',
  'إعدادات فعالة',
  'published',
  'normal',
  'system_settings',
  null,
  jsonb_build_object(
    'institution_name', settings.institution_name,
    'academic_year', settings.academic_year,
    'max_upload_size_mb', settings.max_upload_size_mb,
    'allowed_submission_formats', settings.allowed_submission_formats,
    'medium_risk_below', settings.medium_risk_below,
    'high_risk_below', settings.high_risk_below,
    'suspicious_alert_below', settings.suspicious_alert_below,
    'manual_review_on_extraction_failure', settings.manual_review_on_extraction_failure,
    'auto_start_analysis', settings.auto_start_analysis
  ),
  coalesce(settings.updated_at, settings.created_at, now())
from public.system_settings settings
left join public.profiles profile on profile.id = settings.updated_by
where not exists (
  select 1
  from public.activity_logs log
  where log.entity_type = 'system_settings'
);


-- ============================================================================
-- Migration: 202603240001_activity_log_submission_lifecycle.sql
-- Source: supabase/migrations/202603240001_activity_log_submission_lifecycle.sql
-- ============================================================================
create index if not exists activity_logs_actor_occurred_at_idx
  on public.activity_logs (actor_id, occurred_at desc);

create index if not exists activity_logs_entity_lookup_idx
  on public.activity_logs (entity_type, entity_id, occurred_at desc);

create or replace function public.log_submission_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_title text := '';
  action_text text := 'رفع تسليمًا';
  details_text text := '';
  category_text text := 'submission';
  status_label_text text := 'تم الرفع';
  status_variant_text text := 'submitted';
  priority_text text := 'normal';
  metadata_payload jsonb := '{}'::jsonb;
  event_occurred_at timestamptz := coalesce(new.submitted_at, new.updated_at, new.created_at, now());
begin
  select title
  into assignment_title
  from public.assignments
  where id = new.assignment_id;

  if tg_op = 'UPDATE' then
    if row(
      new.file_name,
      coalesce(new.file_path, ''),
      new.file_size,
      new.submitted_at
    ) is distinct from row(
      old.file_name,
      coalesce(old.file_path, ''),
      old.file_size,
      old.submitted_at
    ) then
      action_text := 'رفع نسخة محدثة';
      status_label_text := 'إعادة الرفع';
      status_variant_text := 'revision';
      event_occurred_at := coalesce(new.updated_at, new.submitted_at, now());
      metadata_payload := jsonb_build_object(
        'assignment_id', new.assignment_id,
        'analysis_status', new.analysis_status,
        'file_name', new.file_name,
        'file_path', new.file_path,
        'previous_file_name', old.file_name,
        'previous_file_path', old.file_path
      );
    elsif new.analysis_status is distinct from old.analysis_status
      and new.analysis_status in ('pending', 'processing') then
      action_text := case
        when new.analysis_status = 'processing' then 'بدأ تحليل الأصالة'
        else 'طلب تحليل الأصالة'
      end;
      category_text := 'analysis';
      status_label_text := case
        when new.analysis_status = 'processing' then 'قيد التحليل'
        else 'بانتظار التحليل'
      end;
      status_variant_text := case
        when new.analysis_status = 'processing' then 'review'
        else 'submitted'
      end;
      event_occurred_at := coalesce(new.analysis_requested_at, new.updated_at, now());
      metadata_payload := jsonb_build_object(
        'assignment_id', new.assignment_id,
        'from_analysis_status', old.analysis_status,
        'to_analysis_status', new.analysis_status,
        'file_name', new.file_name
      );
    else
      return new;
    end if;
  else
    metadata_payload := jsonb_build_object(
      'assignment_id', new.assignment_id,
      'analysis_status', new.analysis_status,
      'file_name', new.file_name,
      'file_path', new.file_path
    );
  end if;

  details_text := concat(coalesce(assignment_title, 'تكليف'), ' - ', coalesce(new.file_name, ''));

  perform public.record_activity_log(
    new.student_id,
    new.student_name,
    'student',
    action_text,
    details_text,
    category_text,
    status_label_text,
    status_variant_text,
    priority_text,
    'submission',
    new.id,
    metadata_payload,
    event_occurred_at
  );

  return new;
end;
$$;

drop trigger if exists activity_logs_on_submission_insert on public.submissions;
drop trigger if exists activity_logs_on_submission_write on public.submissions;
create trigger activity_logs_on_submission_write
after insert or update on public.submissions
for each row execute function public.log_submission_activity();


-- ============================================================================
-- Migration: 202603240002_activity_log_assignment_lifecycle.sql
-- Source: supabase/migrations/202603240002_activity_log_assignment_lifecycle.sql
-- ============================================================================
create or replace function public.log_assignment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action_text text := 'أنشأ تكليفًا';
  details_text text := concat(new.title, ' - ', new.subject);
  status_label_text text := 'منشور';
  status_variant_text text := 'published';
  priority_text text := 'normal';
  metadata_payload jsonb := jsonb_build_object(
    'subject', new.subject,
    'level', new.level,
    'status', new.status,
    'due_at', new.due_at
  );
  event_occurred_at timestamptz := coalesce(new.updated_at, new.created_at, now());
begin
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      action_text := case
        when new.status = 'published' then 'نشر التكليف'
        when new.status = 'closed' then 'أغلق التكليف'
        else 'أعاد التكليف إلى مسودة'
      end;

      status_label_text := case
        when new.status = 'draft' then 'مسودة'
        when new.status = 'closed' then 'مغلق'
        else 'منشور'
      end;

      status_variant_text := case
        when new.status = 'draft' then 'draft'
        when new.status = 'closed' then 'closed'
        else 'published'
      end;

      metadata_payload := metadata_payload || jsonb_build_object(
        'previous_status', old.status
      );
    elsif row(
      new.title,
      new.subject,
      new.level,
      new.due_at,
      new.description,
      new.instructions,
      new.allowed_formats,
      new.max_submissions,
      new.attachments
    ) is distinct from row(
      old.title,
      old.subject,
      old.level,
      old.due_at,
      old.description,
      old.instructions,
      old.allowed_formats,
      old.max_submissions,
      old.attachments
    ) then
      action_text := 'حدّث بيانات التكليف';
      status_label_text := case
        when new.status = 'draft' then 'مسودة'
        when new.status = 'closed' then 'مغلق'
        else 'منشور'
      end;
      status_variant_text := case
        when new.status = 'draft' then 'draft'
        when new.status = 'closed' then 'closed'
        else 'published'
      end;
      metadata_payload := metadata_payload || jsonb_build_object(
        'previous_title', old.title,
        'previous_due_at', old.due_at
      );
    else
      return new;
    end if;
  else
    status_label_text := case
      when new.status = 'draft' then 'مسودة'
      when new.status = 'closed' then 'مغلق'
      else 'منشور'
    end;

    status_variant_text := case
      when new.status = 'draft' then 'draft'
      when new.status = 'closed' then 'closed'
      else 'published'
    end;

    event_occurred_at := coalesce(new.created_at, now());
  end if;

  perform public.record_activity_log(
    new.teacher_id,
    new.teacher_name,
    'teacher',
    action_text,
    details_text,
    'assignment',
    status_label_text,
    status_variant_text,
    priority_text,
    'assignment',
    new.id,
    metadata_payload,
    event_occurred_at
  );

  return new;
end;
$$;

drop trigger if exists activity_logs_on_assignment_insert on public.assignments;
drop trigger if exists activity_logs_on_assignment_write on public.assignments;
create trigger activity_logs_on_assignment_write
after insert or update on public.assignments
for each row execute function public.log_assignment_activity();


-- ============================================================================
-- Migration: 202603240003_accessible_reviews.sql
-- Source: supabase/migrations/202603240003_accessible_reviews.sql
-- ============================================================================
drop policy if exists "reviews_select_owner_teacher_or_admin"
on public.reviews;

create policy "reviews_select_teacher_or_admin"
on public.reviews
for select
to authenticated
using (public.can_manage_submission(submission_id));

create or replace function public.get_accessible_reviews()
returns table (
  id uuid,
  submission_id uuid,
  teacher_id uuid,
  comments text,
  final_decision public.review_final_decision,
  reviewed_at timestamptz,
  manual_evaluation jsonb,
  appeal_status text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with actor as (
    select public.current_user_role() as role
  )
  select
    review_row.id,
    review_row.submission_id,
    review_row.teacher_id,
    review_row.comments,
    review_row.final_decision,
    review_row.reviewed_at,
    case
      when actor.role in ('teacher', 'admin') then review_row.manual_evaluation
      else '{}'::jsonb
    end as manual_evaluation,
    case
      when actor.role in ('teacher', 'admin') then review_row.appeal_status
      else 'none'
    end as appeal_status,
    review_row.created_at,
    review_row.updated_at
  from public.reviews as review_row
  cross join actor
  where (
    actor.role = 'student'
    and public.is_submission_owner(review_row.submission_id)
  ) or (
    actor.role in ('teacher', 'admin')
    and public.can_manage_submission(review_row.submission_id)
  )
  order by
    review_row.reviewed_at desc nulls last,
    review_row.updated_at desc;
$$;

revoke all on function public.get_accessible_reviews() from public;
grant execute on function public.get_accessible_reviews() to authenticated;


-- ============================================================================
-- Migration: 202603240004_activity_log_analysis_outcomes.sql
-- Source: supabase/migrations/202603240004_activity_log_analysis_outcomes.sql
-- ============================================================================
create or replace function public.log_submission_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_title text := '';
  action_text text := 'رفع تسليمًا';
  details_text text := '';
  category_text text := 'submission';
  status_label_text text := 'تم الرفع';
  status_variant_text text := 'submitted';
  priority_text text := 'normal';
  metadata_payload jsonb := '{}'::jsonb;
  event_occurred_at timestamptz := coalesce(new.submitted_at, new.updated_at, new.created_at, now());
begin
  select title
  into assignment_title
  from public.assignments
  where id = new.assignment_id;

  if tg_op = 'UPDATE' then
    if row(
      new.file_name,
      coalesce(new.file_path, ''),
      new.file_size,
      new.submitted_at
    ) is distinct from row(
      old.file_name,
      coalesce(old.file_path, ''),
      old.file_size,
      old.submitted_at
    ) then
      action_text := 'رفع نسخة محدثة';
      status_label_text := 'إعادة الرفع';
      status_variant_text := 'revision';
      event_occurred_at := coalesce(new.updated_at, new.submitted_at, now());
      metadata_payload := jsonb_build_object(
        'assignment_id', new.assignment_id,
        'analysis_status', new.analysis_status,
        'file_name', new.file_name,
        'file_path', new.file_path,
        'previous_file_name', old.file_name,
        'previous_file_path', old.file_path
      );
    elsif new.analysis_status is distinct from old.analysis_status
      and new.analysis_status in ('pending', 'processing') then
      action_text := case
        when new.analysis_status = 'processing' then 'بدأ تحليل الأصالة'
        else 'طلب تحليل الأصالة'
      end;
      category_text := 'analysis';
      status_label_text := case
        when new.analysis_status = 'processing' then 'قيد التحليل'
        else 'بانتظار التحليل'
      end;
      status_variant_text := case
        when new.analysis_status = 'processing' then 'review'
        else 'submitted'
      end;
      event_occurred_at := coalesce(new.analysis_requested_at, new.updated_at, now());
      metadata_payload := jsonb_build_object(
        'assignment_id', new.assignment_id,
        'from_analysis_status', old.analysis_status,
        'to_analysis_status', new.analysis_status,
        'file_name', new.file_name
      );
    elsif new.analysis_status is distinct from old.analysis_status
      and new.analysis_status in ('failed', 'manual_review_required')
      and new.latest_originality_check_id is null then
      action_text := case
        when new.analysis_status = 'failed' then 'فشل تحليل الأصالة'
        else 'تحويل الحالة إلى مراجعة يدوية'
      end;
      category_text := 'analysis';
      status_label_text := case
        when new.analysis_status = 'failed' then 'فشل التحليل'
        else 'مراجعة يدوية'
      end;
      status_variant_text := case
        when new.analysis_status = 'failed' then 'rejected'
        else 'revision'
      end;
      priority_text := 'attention';
      event_occurred_at := coalesce(new.analysis_completed_at, new.updated_at, now());
      metadata_payload := jsonb_build_object(
        'assignment_id', new.assignment_id,
        'from_analysis_status', old.analysis_status,
        'to_analysis_status', new.analysis_status,
        'file_name', new.file_name,
        'analysis_error', coalesce(new.analysis_error, '')
      );
    else
      return new;
    end if;
  else
    metadata_payload := jsonb_build_object(
      'assignment_id', new.assignment_id,
      'analysis_status', new.analysis_status,
      'file_name', new.file_name,
      'file_path', new.file_path
    );
  end if;

  details_text := concat(coalesce(assignment_title, 'تكليف'), ' - ', coalesce(new.file_name, ''));

  if category_text = 'analysis'
    and new.analysis_status in ('failed', 'manual_review_required')
    and coalesce(new.analysis_error, '') <> '' then
    details_text := concat(details_text, ' - ', left(new.analysis_error, 180));
  end if;

  perform public.record_activity_log(
    new.student_id,
    new.student_name,
    'student',
    action_text,
    details_text,
    category_text,
    status_label_text,
    status_variant_text,
    priority_text,
    'submission',
    new.id,
    metadata_payload,
    event_occurred_at
  );

  return new;
end;
$$;

insert into public.activity_logs (
  actor_id,
  actor_name,
  actor_role,
  action,
  details,
  category,
  status_label,
  status_variant,
  priority,
  entity_type,
  entity_id,
  metadata,
  occurred_at
)
select
  submission.student_id,
  submission.student_name,
  'student',
  case
    when submission.analysis_status = 'failed' then 'فشل تحليل الأصالة'
    else 'تحويل الحالة إلى مراجعة يدوية'
  end,
  concat(
    coalesce(assignment.title, 'تكليف'),
    ' - ',
    coalesce(submission.file_name, ''),
    case
      when coalesce(submission.analysis_error, '') <> '' then concat(' - ', left(submission.analysis_error, 180))
      else ''
    end
  ),
  'analysis',
  case
    when submission.analysis_status = 'failed' then 'فشل التحليل'
    else 'مراجعة يدوية'
  end,
  case
    when submission.analysis_status = 'failed' then 'rejected'
    else 'revision'
  end,
  'attention',
  'submission',
  submission.id,
  jsonb_build_object(
    'assignment_id', submission.assignment_id,
    'to_analysis_status', submission.analysis_status,
    'file_name', submission.file_name,
    'analysis_error', coalesce(submission.analysis_error, '')
  ),
  coalesce(submission.analysis_completed_at, submission.updated_at, submission.submitted_at, now())
from public.submissions submission
left join public.assignments assignment on assignment.id = submission.assignment_id
where submission.analysis_status in ('failed', 'manual_review_required')
  and submission.latest_originality_check_id is null
  and not exists (
    select 1
    from public.activity_logs log
    where log.category = 'analysis'
      and log.entity_type = 'submission'
      and log.entity_id = submission.id
      and coalesce(log.metadata ->> 'to_analysis_status', log.metadata ->> 'analysis_status', '') = submission.analysis_status::text
  );


-- ============================================================================
-- Migration: 202603260001_rls_recursion_fix.sql
-- Source: supabase/migrations/202603260001_rls_recursion_fix.sql
-- ============================================================================
drop policy if exists "profiles_select_self_or_admin"
on public.profiles;

create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
);

drop policy if exists "profiles_update_self_or_admin"
on public.profiles;

create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
)
with check (
  id = auth.uid()
  or public.is_admin()
);

drop policy if exists "assignments_insert_teacher_or_admin"
on public.assignments;

create policy "assignments_insert_teacher_or_admin"
on public.assignments
for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and public.current_user_role() in ('teacher', 'admin')
);

drop policy if exists "assignments_update_owner_or_admin"
on public.assignments;

create policy "assignments_update_owner_or_admin"
on public.assignments
for update
to authenticated
using (
  teacher_id = auth.uid()
  or public.is_admin()
)
with check (
  teacher_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "submissions_select_owner_teacher_or_admin"
on public.submissions;

create policy "submissions_select_owner_teacher_or_admin"
on public.submissions
for select
to authenticated
using (
  student_id = auth.uid()
  or public.can_manage_submission(id)
  or public.is_admin()
);


-- ============================================================================
-- Migration: 202603260002_notification_reads.sql
-- Source: supabase/migrations/202603260002_notification_reads.sql
-- ============================================================================
create table if not exists public.notification_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  notification_id text not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, notification_id)
);

create index if not exists notification_reads_user_id_read_at_idx
  on public.notification_reads (user_id, read_at desc);

alter table public.notification_reads enable row level security;

drop policy if exists notification_reads_select_self on public.notification_reads;
create policy notification_reads_select_self
on public.notification_reads
for select
using (user_id = auth.uid());

drop policy if exists notification_reads_insert_self on public.notification_reads;
create policy notification_reads_insert_self
on public.notification_reads
for insert
with check (user_id = auth.uid());

drop policy if exists notification_reads_update_self on public.notification_reads;
create policy notification_reads_update_self
on public.notification_reads
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notification_reads_delete_self on public.notification_reads;
create policy notification_reads_delete_self
on public.notification_reads
for delete
using (user_id = auth.uid());


-- ============================================================================
-- Migration: 202603260003_student_subject_enrollments.sql
-- Source: supabase/migrations/202603260003_student_subject_enrollments.sql
-- ============================================================================
create table if not exists public.student_subjects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, subject_id)
);

create index if not exists student_subjects_student_id_idx
  on public.student_subjects (student_id);

create index if not exists student_subjects_subject_id_idx
  on public.student_subjects (subject_id);

alter table public.student_subjects enable row level security;

drop policy if exists "student_subjects_select_self_or_admin"
on public.student_subjects;

create policy "student_subjects_select_self_or_admin"
on public.student_subjects
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "student_subjects_manage_admin"
on public.student_subjects;

create policy "student_subjects_manage_admin"
on public.student_subjects
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.student_subjects (student_id, subject_id)
select distinct
  submission.student_id,
  assignment.subject_id
from public.submissions submission
join public.assignments assignment on assignment.id = submission.assignment_id
where assignment.subject_id is not null
on conflict (student_id, subject_id) do nothing;

create or replace function public.can_student_access_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments assignment
    join public.profiles student_profile on student_profile.id = auth.uid()
    left join public.subjects subject on subject.id = assignment.subject_id
    where assignment.id = target_assignment_id
      and student_profile.role = 'student'
      and assignment.status = 'published'
      and (
        coalesce(assignment.level, '') = ''
        or coalesce(student_profile.level, '') = ''
        or assignment.level = student_profile.level
      )
      and (
        assignment.subject_id is null
        or (
          (
            exists (
              select 1
              from public.student_subjects student_subject
              where student_subject.subject_id = assignment.subject_id
            )
            and exists (
              select 1
              from public.student_subjects student_subject
              where student_subject.subject_id = assignment.subject_id
                and student_subject.student_id = student_profile.id
            )
          )
          or (
            not exists (
              select 1
              from public.student_subjects student_subject
              where student_subject.subject_id = assignment.subject_id
            )
            and (
              coalesce(subject.department, '') = ''
              or coalesce(student_profile.department, '') = ''
              or subject.department = student_profile.department
            )
            and (
              coalesce(subject.level, '') = ''
              or coalesce(student_profile.level, '') = ''
              or subject.level = student_profile.level
            )
            and (
              coalesce(subject.semester, '') = ''
              or coalesce(student_profile.semester, '') = ''
              or subject.semester = student_profile.semester
            )
          )
        )
      )
  )
$$;


-- ============================================================================
-- Migration: 202603260004_subject_section_scoping.sql
-- Source: supabase/migrations/202603260004_subject_section_scoping.sql
-- ============================================================================
alter table public.assignments
  add column if not exists section_label text not null default '';

alter table public.teacher_subjects
  add column if not exists section_label text not null default '';

alter table public.student_subjects
  add column if not exists section_label text not null default '';

alter table public.teacher_subjects
  drop constraint if exists teacher_subjects_teacher_id_subject_id_key;

alter table public.student_subjects
  drop constraint if exists student_subjects_student_id_subject_id_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teacher_subjects_teacher_id_subject_id_section_label_key'
  ) then
    alter table public.teacher_subjects
      add constraint teacher_subjects_teacher_id_subject_id_section_label_key
      unique (teacher_id, subject_id, section_label);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_subjects_student_id_subject_id_section_label_key'
  ) then
    alter table public.student_subjects
      add constraint student_subjects_student_id_subject_id_section_label_key
      unique (student_id, subject_id, section_label);
  end if;
end $$;

create index if not exists assignments_subject_section_idx
  on public.assignments (subject_id, section_label);

create index if not exists teacher_subjects_subject_section_idx
  on public.teacher_subjects (subject_id, section_label);

create index if not exists student_subjects_subject_section_idx
  on public.student_subjects (subject_id, section_label);

create or replace function public.can_student_access_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments assignment
    join public.profiles student_profile on student_profile.id = auth.uid()
    left join public.subjects subject on subject.id = assignment.subject_id
    where assignment.id = target_assignment_id
      and student_profile.role = 'student'
      and assignment.status = 'published'
      and (
        coalesce(assignment.level, '') = ''
        or coalesce(student_profile.level, '') = ''
        or assignment.level = student_profile.level
      )
      and (
        assignment.subject_id is null
        or (
          (
            exists (
              select 1
              from public.student_subjects student_subject
              where student_subject.subject_id = assignment.subject_id
            )
            and exists (
              select 1
              from public.student_subjects student_subject
              where student_subject.subject_id = assignment.subject_id
                and student_subject.student_id = student_profile.id
                and (
                  coalesce(assignment.section_label, '') = ''
                  or student_subject.section_label = coalesce(assignment.section_label, '')
                )
            )
          )
          or (
            not exists (
              select 1
              from public.student_subjects student_subject
              where student_subject.subject_id = assignment.subject_id
            )
            and (
              coalesce(subject.department, '') = ''
              or coalesce(student_profile.department, '') = ''
              or subject.department = student_profile.department
            )
            and (
              coalesce(subject.level, '') = ''
              or coalesce(student_profile.level, '') = ''
              or subject.level = student_profile.level
            )
            and (
              coalesce(subject.semester, '') = ''
              or coalesce(student_profile.semester, '') = ''
              or subject.semester = student_profile.semester
            )
          )
        )
      )
  )
$$;


-- ============================================================================
-- Migration: 202603270001_seed_academic_subject_catalog.sql
-- Source: supabase/migrations/202603270001_seed_academic_subject_catalog.sql
-- ============================================================================
with seed(code, name_ar, name_en, department, level, semester, status) as (
  values
    ('IT101', 'مقدمة في تقنية المعلومات', 'Introduction to Information Technology', 'تقنية المعلومات', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('IT221', 'شبكات الحاسوب', 'Computer Networks', 'تقنية المعلومات', 'المستوى الثاني', 'الفصل الثاني', 'active'),
    ('IT331', 'أمن المعلومات', 'Information Security', 'تقنية المعلومات', 'المستوى الثالث', 'الفصل الأول', 'active'),
    ('CS101', 'برمجة 1', 'Programming 1', 'علوم الحاسوب', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('CS202', 'هياكل البيانات', 'Data Structures', 'علوم الحاسوب', 'المستوى الثاني', 'الفصل الثاني', 'active'),
    ('CS431', 'الذكاء الاصطناعي', 'Artificial Intelligence', 'علوم الحاسوب', 'المستوى الرابع', 'الفصل الأول', 'active'),
    ('IS301', 'تحليل وتصميم النظم', 'Systems Analysis and Design', 'نظم المعلومات', 'المستوى الثالث', 'الفصل الأول', 'active'),
    ('IS302', 'قواعد البيانات', 'Databases', 'نظم المعلومات', 'المستوى الثالث', 'الفصل الثاني', 'active'),
    ('IS411', 'نظم تخطيط الموارد', 'Enterprise Resource Planning', 'نظم المعلومات', 'المستوى الرابع', 'الفصل الأول', 'active'),
    ('SE301', 'هندسة البرمجيات', 'Software Engineering', 'هندسة البرمجيات', 'المستوى الثالث', 'الفصل الأول', 'active'),
    ('SE402', 'اختبار البرمجيات', 'Software Testing', 'هندسة البرمجيات', 'المستوى الرابع', 'الفصل الأول', 'active'),
    ('SE404', 'إدارة المشاريع البرمجية', 'Software Project Management', 'هندسة البرمجيات', 'المستوى الرابع', 'الفصل الثاني', 'active'),
    ('BA101', 'مبادئ الإدارة', 'Principles of Management', 'إدارة الأعمال', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('BA221', 'إدارة الموارد البشرية', 'Human Resources Management', 'إدارة الأعمال', 'المستوى الثاني', 'الفصل الثاني', 'active'),
    ('BA331', 'الإدارة الاستراتيجية', 'Strategic Management', 'إدارة الأعمال', 'المستوى الثالث', 'الفصل الأول', 'active'),
    ('ACC101', 'مبادئ المحاسبة', 'Principles of Accounting', 'المحاسبة', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('ACC201', 'المحاسبة المالية', 'Financial Accounting', 'المحاسبة', 'المستوى الثاني', 'الفصل الأول', 'active'),
    ('ACC301', 'المحاسبة الإدارية', 'Managerial Accounting', 'المحاسبة', 'المستوى الثالث', 'الفصل الثاني', 'active'),
    ('MKT101', 'مبادئ التسويق', 'Principles of Marketing', 'التسويق', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('MKT222', 'التسويق الرقمي', 'Digital Marketing', 'التسويق', 'المستوى الثاني', 'الفصل الثاني', 'active'),
    ('MKT315', 'سلوك المستهلك', 'Consumer Behavior', 'التسويق', 'المستوى الثالث', 'الفصل الأول', 'active'),
    ('ENG101', 'مهارات القراءة', 'Reading Skills', 'اللغة الإنجليزية', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('ENG102', 'مهارات الكتابة', 'Writing Skills', 'اللغة الإنجليزية', 'المستوى الأول', 'الفصل الثاني', 'active'),
    ('ENG203', 'الترجمة', 'Translation', 'اللغة الإنجليزية', 'المستوى الثاني', 'الفصل الثاني', 'active'),
    ('GD101', 'مبادئ التصميم', 'Design Principles', 'التصميم الجرافيكي', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('GD215', 'تصميم الهوية البصرية', 'Visual Identity Design', 'التصميم الجرافيكي', 'المستوى الثاني', 'الفصل الأول', 'active'),
    ('GD320', 'تصميم الإعلانات', 'Advertising Design', 'التصميم الجرافيكي', 'المستوى الثالث', 'الفصل الثاني', 'active'),
    ('NUR101', 'أساسيات التمريض', 'Fundamentals of Nursing', 'التمريض', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('NUR221', 'تمريض الباطنة والجراحة', 'Medical Surgical Nursing', 'التمريض', 'المستوى الثاني', 'الفصل الثاني', 'active'),
    ('NUR331', 'صحة الأم والطفل', 'Maternal and Child Health', 'التمريض', 'المستوى الثالث', 'الفصل الأول', 'active')
),
updated as (
  update public.subjects subject
  set
    name_ar = seed.name_ar,
    name_en = seed.name_en,
    department = seed.department,
    level = seed.level,
    semester = seed.semester,
    status = seed.status,
    updated_at = now()
  from seed
  where subject.code = seed.code
  returning subject.code
)
insert into public.subjects (
  name_ar,
  name_en,
  code,
  department,
  level,
  semester,
  status
)
select
  seed.name_ar,
  seed.name_en,
  seed.code,
  seed.department,
  seed.level,
  seed.semester,
  seed.status
from seed
where not exists (
  select 1
  from public.subjects subject
  where subject.code = seed.code
);


-- ============================================================================
-- Migration: 202603280001_remove_sections_and_word_protection.sql
-- Source: supabase/migrations/202603280001_remove_sections_and_word_protection.sql
-- ============================================================================
delete from public.teacher_subjects teacher_subject
where exists (
  select 1
  from public.teacher_subjects duplicate
  where duplicate.teacher_id = teacher_subject.teacher_id
    and duplicate.subject_id = teacher_subject.subject_id
    and (
      duplicate.created_at < teacher_subject.created_at
      or (duplicate.created_at = teacher_subject.created_at and duplicate.id < teacher_subject.id)
    )
);

delete from public.student_subjects student_subject
where exists (
  select 1
  from public.student_subjects duplicate
  where duplicate.student_id = student_subject.student_id
    and duplicate.subject_id = student_subject.subject_id
    and (
      duplicate.created_at < student_subject.created_at
      or (duplicate.created_at = student_subject.created_at and duplicate.id < student_subject.id)
    )
);

drop index if exists public.assignments_subject_section_idx;
drop index if exists public.teacher_subjects_subject_section_idx;
drop index if exists public.student_subjects_subject_section_idx;

alter table public.teacher_subjects
  drop constraint if exists teacher_subjects_teacher_id_subject_id_section_label_key;

alter table public.student_subjects
  drop constraint if exists student_subjects_student_id_subject_id_section_label_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teacher_subjects_teacher_id_subject_id_key'
  ) then
    alter table public.teacher_subjects
      add constraint teacher_subjects_teacher_id_subject_id_key
      unique (teacher_id, subject_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_subjects_student_id_subject_id_key'
  ) then
    alter table public.student_subjects
      add constraint student_subjects_student_id_subject_id_key
      unique (student_id, subject_id);
  end if;
end $$;

alter table public.assignments
  drop column if exists section_label;

alter table public.teacher_subjects
  drop column if exists section_label;

alter table public.student_subjects
  drop column if exists section_label;

alter table public.assignments
  drop column if exists word_protection_enabled;

create or replace function public.can_student_access_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments assignment
    join public.profiles student_profile on student_profile.id = auth.uid()
    left join public.subjects subject on subject.id = assignment.subject_id
    where assignment.id = target_assignment_id
      and student_profile.role = 'student'
      and assignment.status = 'published'
      and (
        coalesce(assignment.level, '') = ''
        or coalesce(student_profile.level, '') = ''
        or assignment.level = student_profile.level
      )
      and (
        assignment.subject_id is null
        or (
          (
            exists (
              select 1
              from public.student_subjects student_subject
              where student_subject.subject_id = assignment.subject_id
            )
            and exists (
              select 1
              from public.student_subjects student_subject
              where student_subject.subject_id = assignment.subject_id
                and student_subject.student_id = student_profile.id
            )
          )
          or (
            not exists (
              select 1
              from public.student_subjects student_subject
              where student_subject.subject_id = assignment.subject_id
            )
            and (
              coalesce(subject.department, '') = ''
              or coalesce(student_profile.department, '') = ''
              or subject.department = student_profile.department
            )
            and (
              coalesce(subject.level, '') = ''
              or coalesce(student_profile.level, '') = ''
              or subject.level = student_profile.level
            )
            and (
              coalesce(subject.semester, '') = ''
              or coalesce(student_profile.semester, '') = ''
              or subject.semester = student_profile.semester
            )
          )
        )
      )
  )
$$;

