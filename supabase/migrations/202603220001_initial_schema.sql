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
