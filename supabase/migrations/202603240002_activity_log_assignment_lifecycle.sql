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
