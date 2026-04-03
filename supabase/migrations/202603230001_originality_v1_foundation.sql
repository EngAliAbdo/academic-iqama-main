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
