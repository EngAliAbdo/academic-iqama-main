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
