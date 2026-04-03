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
