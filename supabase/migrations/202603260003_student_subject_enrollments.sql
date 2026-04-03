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
