create table if not exists public.system_settings (
  id boolean primary key default true check (id),
  institution_name text not null default 'جامعة المعرفة',
  academic_year text not null default '1447 هـ',
  max_upload_size_mb integer not null default 10
    check (max_upload_size_mb >= 1 and max_upload_size_mb <= 100),
  allowed_submission_formats text[] not null default array['PDF', 'DOCX']::text[]
    check (
      coalesce(array_length(allowed_submission_formats, 1), 0) > 0
      and allowed_submission_formats <@ array['PDF', 'DOCX']::text[]
    ),
  medium_risk_below integer not null default 80
    check (medium_risk_below >= 1 and medium_risk_below <= 100),
  high_risk_below integer not null default 50
    check (high_risk_below >= 1 and high_risk_below <= 99),
  suspicious_alert_below integer not null default 60
    check (suspicious_alert_below >= 1 and suspicious_alert_below <= 100),
  manual_review_on_extraction_failure boolean not null default true,
  auto_start_analysis boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (high_risk_below < medium_risk_below),
  check (suspicious_alert_below >= high_risk_below and suspicious_alert_below <= medium_risk_below)
);

create trigger system_settings_set_updated_at
before update on public.system_settings
for each row execute function public.handle_updated_at();

insert into public.system_settings (
  id,
  institution_name,
  academic_year,
  max_upload_size_mb,
  allowed_submission_formats,
  medium_risk_below,
  high_risk_below,
  suspicious_alert_below,
  manual_review_on_extraction_failure,
  auto_start_analysis
)
values (
  true,
  'جامعة المعرفة',
  '1447 هـ',
  10,
  array['PDF', 'DOCX']::text[],
  80,
  50,
  60,
  true,
  true
)
on conflict (id) do nothing;

alter table public.system_settings enable row level security;

create policy "system_settings_select_authenticated"
on public.system_settings
for select
to authenticated
using (true);

create policy "system_settings_insert_admin"
on public.system_settings
for insert
to authenticated
with check (public.is_admin());

create policy "system_settings_update_admin"
on public.system_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
