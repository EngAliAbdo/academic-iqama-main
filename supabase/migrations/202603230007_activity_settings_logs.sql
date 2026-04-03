alter table public.activity_logs
  drop constraint if exists activity_logs_category_check;

alter table public.activity_logs
  add constraint activity_logs_category_check
  check (category in ('assignment', 'submission', 'analysis', 'review', 'settings'));

create or replace function public.record_activity_log(
  target_actor_id uuid,
  target_actor_name text,
  target_actor_role text,
  target_action text,
  target_details text,
  target_category text,
  target_status_label text,
  target_status_variant text,
  target_priority text,
  target_entity_type text,
  target_entity_id uuid,
  target_metadata jsonb default '{}'::jsonb,
  target_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
  values (
    target_actor_id,
    coalesce(nullif(target_actor_name, ''), 'النظام'),
    case
      when target_actor_role in ('student', 'teacher', 'admin', 'system') then target_actor_role
      else 'system'
    end,
    coalesce(target_action, ''),
    coalesce(target_details, ''),
    case
      when target_category in ('assignment', 'submission', 'analysis', 'review', 'settings') then target_category
      else 'analysis'
    end,
    coalesce(target_status_label, ''),
    case
      when target_status_variant in ('draft', 'published', 'submitted', 'review', 'revision', 'graded', 'accepted', 'rejected', 'flagged', 'closed') then target_status_variant
      else 'review'
    end,
    case
      when target_priority in ('normal', 'attention', 'critical') then target_priority
      else 'normal'
    end,
    coalesce(target_entity_type, ''),
    target_entity_id,
    coalesce(target_metadata, '{}'::jsonb),
    coalesce(target_occurred_at, now())
  );
end;
$$;

create or replace function public.log_system_settings_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name_value text := 'النظام';
  action_text text := 'اعتمد إعدادات النظام';
  details_text text := '';
begin
  if tg_op = 'UPDATE'
    and row(
      new.institution_name,
      new.academic_year,
      new.max_upload_size_mb,
      new.allowed_submission_formats,
      new.medium_risk_below,
      new.high_risk_below,
      new.suspicious_alert_below,
      new.manual_review_on_extraction_failure,
      new.auto_start_analysis
    ) is not distinct from row(
      old.institution_name,
      old.academic_year,
      old.max_upload_size_mb,
      old.allowed_submission_formats,
      old.medium_risk_below,
      old.high_risk_below,
      old.suspicious_alert_below,
      old.manual_review_on_extraction_failure,
      old.auto_start_analysis
    ) then
    return new;
  end if;

  if new.updated_by is not null then
    select coalesce(full_name_ar, full_name, 'مدير النظام')
    into actor_name_value
    from public.profiles
    where id = new.updated_by;
  end if;

  if tg_op = 'UPDATE' then
    action_text := 'حدّث إعدادات النظام';
  end if;

  details_text := concat(
    coalesce(new.institution_name, 'المؤسسة'),
    ' - ',
    coalesce(new.academic_year, ''),
    ' - رفع ',
    new.max_upload_size_mb,
    'MB - تنبيه ',
    new.suspicious_alert_below,
    '%'
  );

  perform public.record_activity_log(
    new.updated_by,
    actor_name_value,
    case when new.updated_by is null then 'system' else 'admin' end,
    action_text,
    details_text,
    'settings',
    case when tg_op = 'UPDATE' then 'تم التحديث' else 'إعدادات فعالة' end,
    'published',
    'normal',
    'system_settings',
    null,
    jsonb_build_object(
      'institution_name', new.institution_name,
      'academic_year', new.academic_year,
      'max_upload_size_mb', new.max_upload_size_mb,
      'allowed_submission_formats', new.allowed_submission_formats,
      'medium_risk_below', new.medium_risk_below,
      'high_risk_below', new.high_risk_below,
      'suspicious_alert_below', new.suspicious_alert_below,
      'manual_review_on_extraction_failure', new.manual_review_on_extraction_failure,
      'auto_start_analysis', new.auto_start_analysis
    ),
    coalesce(new.updated_at, now())
  );

  return new;
end;
$$;

drop trigger if exists activity_logs_on_system_settings_write on public.system_settings;
create trigger activity_logs_on_system_settings_write
after insert or update on public.system_settings
for each row execute function public.log_system_settings_activity();

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
  settings.updated_by,
  coalesce(profile.full_name_ar, profile.full_name, 'النظام'),
  case when settings.updated_by is null then 'system' else 'admin' end,
  'اعتمد إعدادات النظام',
  concat(
    settings.institution_name,
    ' - ',
    settings.academic_year,
    ' - رفع ',
    settings.max_upload_size_mb,
    'MB - تنبيه ',
    settings.suspicious_alert_below,
    '%'
  ),
  'settings',
  'إعدادات فعالة',
  'published',
  'normal',
  'system_settings',
  null,
  jsonb_build_object(
    'institution_name', settings.institution_name,
    'academic_year', settings.academic_year,
    'max_upload_size_mb', settings.max_upload_size_mb,
    'allowed_submission_formats', settings.allowed_submission_formats,
    'medium_risk_below', settings.medium_risk_below,
    'high_risk_below', settings.high_risk_below,
    'suspicious_alert_below', settings.suspicious_alert_below,
    'manual_review_on_extraction_failure', settings.manual_review_on_extraction_failure,
    'auto_start_analysis', settings.auto_start_analysis
  ),
  coalesce(settings.updated_at, settings.created_at, now())
from public.system_settings settings
left join public.profiles profile on profile.id = settings.updated_by
where not exists (
  select 1
  from public.activity_logs log
  where log.entity_type = 'system_settings'
);
