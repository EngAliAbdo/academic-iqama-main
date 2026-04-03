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
