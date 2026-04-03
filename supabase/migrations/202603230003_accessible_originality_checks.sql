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
