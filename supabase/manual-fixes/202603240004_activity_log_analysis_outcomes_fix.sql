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
