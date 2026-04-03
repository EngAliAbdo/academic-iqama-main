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
