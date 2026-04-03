create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null default '',
  actor_role text not null default 'system'
    check (actor_role in ('student', 'teacher', 'admin', 'system')),
  action text not null default '',
  details text not null default '',
  category text not null default 'analysis'
    check (category in ('assignment', 'submission', 'analysis', 'review')),
  status_label text not null default '',
  status_variant text not null default 'review'
    check (status_variant in ('draft', 'published', 'submitted', 'review', 'revision', 'graded', 'accepted', 'rejected', 'flagged', 'closed')),
  priority text not null default 'normal'
    check (priority in ('normal', 'attention', 'critical')),
  entity_type text not null default '',
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_occurred_at_idx
  on public.activity_logs (occurred_at desc);

create index if not exists activity_logs_category_idx
  on public.activity_logs (category, occurred_at desc);

create index if not exists activity_logs_priority_idx
  on public.activity_logs (priority, occurred_at desc);

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
      when target_category in ('assignment', 'submission', 'analysis', 'review') then target_category
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

create or replace function public.log_assignment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.record_activity_log(
    new.teacher_id,
    new.teacher_name,
    'teacher',
    'أنشأ تكليفاً',
    concat(new.title, ' - ', new.subject),
    'assignment',
    case
      when new.status = 'draft' then 'مسودة'
      when new.status = 'closed' then 'مغلق'
      else 'منشور'
    end,
    case
      when new.status = 'draft' then 'draft'
      when new.status = 'closed' then 'closed'
      else 'published'
    end,
    'normal',
    'assignment',
    new.id,
    jsonb_build_object(
      'subject', new.subject,
      'level', new.level,
      'status', new.status
    ),
    coalesce(new.created_at, now())
  );

  return new;
end;
$$;

create or replace function public.log_submission_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_title text := '';
begin
  select title
  into assignment_title
  from public.assignments
  where id = new.assignment_id;

  perform public.record_activity_log(
    new.student_id,
    new.student_name,
    'student',
    'رفع تسليماً',
    concat(coalesce(assignment_title, 'تكليف'), ' - ', new.file_name),
    'submission',
    'تم الرفع',
    'submitted',
    'normal',
    'submission',
    new.id,
    jsonb_build_object(
      'assignment_id', new.assignment_id,
      'analysis_status', new.analysis_status,
      'file_name', new.file_name
    ),
    coalesce(new.submitted_at, now())
  );

  return new;
end;
$$;

create or replace function public.log_originality_check_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_row public.submissions%rowtype;
  assignment_row public.assignments%rowtype;
  action_text text := 'اكتمل تحليل الأصالة';
  details_text text := '';
  status_label_text text := 'منخفضة';
  status_variant_text text := 'accepted';
  priority_text text := 'normal';
begin
  select *
  into submission_row
  from public.submissions
  where id = new.submission_id;

  if submission_row.id is null then
    return new;
  end if;

  select *
  into assignment_row
  from public.assignments
  where id = submission_row.assignment_id;

  if new.analysis_status = 'manual_review_required' then
    action_text := 'حوّل الحالة إلى مراجعة يدوية';
    status_label_text := 'مراجعة يدوية';
    status_variant_text := 'revision';
    priority_text := 'attention';
  elsif new.analysis_status = 'failed' then
    action_text := 'فشل تحليل الأصالة';
    status_label_text := 'فشل التحليل';
    status_variant_text := 'rejected';
    priority_text := 'attention';
  elsif new.risk_level = 'high' then
    action_text := 'اكتمل التحليل مع اشتباه مرتفع';
    status_label_text := 'خطورة مرتفعة';
    status_variant_text := 'flagged';
    priority_text := 'critical';
  elsif new.risk_level = 'medium' then
    action_text := 'اكتمل التحليل ويحتاج متابعة';
    status_label_text := 'خطورة متوسطة';
    status_variant_text := 'review';
    priority_text := 'attention';
  else
    status_label_text := 'خطورة منخفضة';
    status_variant_text := 'accepted';
  end if;

  details_text := concat(
    coalesce(assignment_row.title, 'تكليف'),
    ' - ',
    submission_row.student_name,
    ' - أصالة ',
    new.originality_score,
    '%'
  );

  perform public.record_activity_log(
    null,
    'النظام',
    'system',
    action_text,
    details_text,
    'analysis',
    status_label_text,
    status_variant_text,
    priority_text,
    'originality_check',
    new.id,
    jsonb_build_object(
      'submission_id', new.submission_id,
      'risk_level', new.risk_level,
      'recommended_status', new.recommended_status,
      'matching_percentage', new.matching_percentage
    ),
    coalesce(new.analyzed_at, new.created_at, now())
  );

  return new;
end;
$$;

create or replace function public.log_review_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_row public.submissions%rowtype;
  assignment_row public.assignments%rowtype;
  teacher_name text := 'المعلم';
  decision_label text := 'قيد المراجعة';
  status_variant_text text := 'review';
  priority_text text := 'normal';
  grade_value text := '';
begin
  if tg_op = 'UPDATE'
    and row(new.comments, new.final_decision, new.reviewed_at, new.manual_evaluation)
      is not distinct from row(old.comments, old.final_decision, old.reviewed_at, old.manual_evaluation) then
    return new;
  end if;

  select *
  into submission_row
  from public.submissions
  where id = new.submission_id;

  if submission_row.id is null then
    return new;
  end if;

  select *
  into assignment_row
  from public.assignments
  where id = submission_row.assignment_id;

  select coalesce(full_name_ar, full_name, 'المعلم')
  into teacher_name
  from public.profiles
  where id = new.teacher_id;

  if new.final_decision = 'accepted' then
    decision_label := 'مقبول';
    status_variant_text := 'accepted';
  elsif new.final_decision = 'rejected' then
    decision_label := 'غير مقبول';
    status_variant_text := 'rejected';
    priority_text := 'attention';
  elsif new.final_decision = 'revision' then
    decision_label := 'يحتاج تعديل';
    status_variant_text := 'revision';
    priority_text := 'attention';
  elsif (new.manual_evaluation ->> 'grade') is not null then
    decision_label := 'تم التقييم';
    status_variant_text := 'graded';
  end if;

  if (new.manual_evaluation ->> 'grade') is not null then
    grade_value := concat(' - الدرجة ', new.manual_evaluation ->> 'grade');
  end if;

  perform public.record_activity_log(
    new.teacher_id,
    teacher_name,
    'teacher',
    case
      when new.final_decision is null then 'سجل ملاحظات التقييم'
      else 'أصدر قرار المراجعة'
    end,
    concat(
      submission_row.student_name,
      ' - ',
      coalesce(assignment_row.title, 'تكليف'),
      ' - ',
      decision_label,
      grade_value
    ),
    'review',
    decision_label,
    status_variant_text,
    priority_text,
    'review',
    new.id,
    jsonb_build_object(
      'submission_id', new.submission_id,
      'final_decision', new.final_decision,
      'appeal_status', new.appeal_status
    ),
    coalesce(new.reviewed_at, new.updated_at, now())
  );

  return new;
end;
$$;

drop trigger if exists activity_logs_on_assignment_insert on public.assignments;
create trigger activity_logs_on_assignment_insert
after insert on public.assignments
for each row execute function public.log_assignment_activity();

drop trigger if exists activity_logs_on_submission_insert on public.submissions;
create trigger activity_logs_on_submission_insert
after insert on public.submissions
for each row execute function public.log_submission_activity();

drop trigger if exists activity_logs_on_originality_check_insert on public.originality_checks;
create trigger activity_logs_on_originality_check_insert
after insert on public.originality_checks
for each row execute function public.log_originality_check_activity();

drop trigger if exists activity_logs_on_review_write on public.reviews;
create trigger activity_logs_on_review_write
after insert or update on public.reviews
for each row execute function public.log_review_activity();

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
  assignment.teacher_id,
  coalesce(profile.full_name_ar, profile.full_name, assignment.teacher_name),
  'teacher',
  'أنشأ تكليفاً',
  concat(assignment.title, ' - ', assignment.subject),
  'assignment',
  case
    when assignment.status = 'draft' then 'مسودة'
    when assignment.status = 'closed' then 'مغلق'
    else 'منشور'
  end,
  case
    when assignment.status = 'draft' then 'draft'
    when assignment.status = 'closed' then 'closed'
    else 'published'
  end,
  'normal',
  'assignment',
  assignment.id,
  jsonb_build_object(
    'subject', assignment.subject,
    'level', assignment.level,
    'status', assignment.status
  ),
  assignment.created_at
from public.assignments assignment
left join public.profiles profile on profile.id = assignment.teacher_id
where not exists (select 1 from public.activity_logs);

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
  'رفع تسليماً',
  concat(coalesce(assignment.title, 'تكليف'), ' - ', submission.file_name),
  'submission',
  'تم الرفع',
  'submitted',
  'normal',
  'submission',
  submission.id,
  jsonb_build_object(
    'assignment_id', submission.assignment_id,
    'analysis_status', submission.analysis_status,
    'file_name', submission.file_name
  ),
  submission.submitted_at
from public.submissions submission
left join public.assignments assignment on assignment.id = submission.assignment_id
where not exists (
  select 1
  from public.activity_logs log
  where log.entity_type = 'submission'
);

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
  null,
  'النظام',
  'system',
  case
    when check_row.analysis_status = 'manual_review_required' then 'حوّل الحالة إلى مراجعة يدوية'
    when check_row.analysis_status = 'failed' then 'فشل تحليل الأصالة'
    when check_row.risk_level = 'high' then 'اكتمل التحليل مع اشتباه مرتفع'
    when check_row.risk_level = 'medium' then 'اكتمل التحليل ويحتاج متابعة'
    else 'اكتمل تحليل الأصالة'
  end,
  concat(
    coalesce(assignment.title, 'تكليف'),
    ' - ',
    submission.student_name,
    ' - أصالة ',
    check_row.originality_score,
    '%'
  ),
  'analysis',
  case
    when check_row.analysis_status = 'manual_review_required' then 'مراجعة يدوية'
    when check_row.analysis_status = 'failed' then 'فشل التحليل'
    when check_row.risk_level = 'high' then 'خطورة مرتفعة'
    when check_row.risk_level = 'medium' then 'خطورة متوسطة'
    else 'خطورة منخفضة'
  end,
  case
    when check_row.analysis_status = 'manual_review_required' then 'revision'
    when check_row.analysis_status = 'failed' then 'rejected'
    when check_row.risk_level = 'high' then 'flagged'
    when check_row.risk_level = 'medium' then 'review'
    else 'accepted'
  end,
  case
    when check_row.risk_level = 'high' then 'critical'
    when check_row.analysis_status in ('failed', 'manual_review_required') or check_row.risk_level = 'medium' then 'attention'
    else 'normal'
  end,
  'originality_check',
  check_row.id,
  jsonb_build_object(
    'submission_id', check_row.submission_id,
    'risk_level', check_row.risk_level,
    'recommended_status', check_row.recommended_status,
    'matching_percentage', check_row.matching_percentage
  ),
  coalesce(check_row.analyzed_at, check_row.created_at)
from public.originality_checks check_row
join public.submissions submission on submission.id = check_row.submission_id
left join public.assignments assignment on assignment.id = submission.assignment_id
where not exists (
  select 1
  from public.activity_logs log
  where log.entity_type = 'originality_check'
);

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
  review.teacher_id,
  coalesce(profile.full_name_ar, profile.full_name, assignment.teacher_name, 'المعلم'),
  'teacher',
  case
    when review.final_decision is null then 'سجل ملاحظات التقييم'
    else 'أصدر قرار المراجعة'
  end,
  concat(
    submission.student_name,
    ' - ',
    coalesce(assignment.title, 'تكليف'),
    ' - ',
    case
      when review.final_decision = 'accepted' then 'مقبول'
      when review.final_decision = 'rejected' then 'غير مقبول'
      when review.final_decision = 'revision' then 'يحتاج تعديل'
      when (review.manual_evaluation ->> 'grade') is not null then 'تم التقييم'
      else 'قيد المراجعة'
    end,
    case
      when (review.manual_evaluation ->> 'grade') is not null then concat(' - الدرجة ', review.manual_evaluation ->> 'grade')
      else ''
    end
  ),
  'review',
  case
    when review.final_decision = 'accepted' then 'مقبول'
    when review.final_decision = 'rejected' then 'غير مقبول'
    when review.final_decision = 'revision' then 'يحتاج تعديل'
    when (review.manual_evaluation ->> 'grade') is not null then 'تم التقييم'
    else 'قيد المراجعة'
  end,
  case
    when review.final_decision = 'accepted' then 'accepted'
    when review.final_decision = 'rejected' then 'rejected'
    when review.final_decision = 'revision' then 'revision'
    when (review.manual_evaluation ->> 'grade') is not null then 'graded'
    else 'review'
  end,
  case
    when review.final_decision in ('rejected', 'revision') then 'attention'
    else 'normal'
  end,
  'review',
  review.id,
  jsonb_build_object(
    'submission_id', review.submission_id,
    'final_decision', review.final_decision,
    'appeal_status', review.appeal_status
  ),
  coalesce(review.reviewed_at, review.updated_at, review.created_at)
from public.reviews review
join public.submissions submission on submission.id = review.submission_id
left join public.assignments assignment on assignment.id = submission.assignment_id
left join public.profiles profile on profile.id = review.teacher_id
where not exists (
  select 1
  from public.activity_logs log
  where log.entity_type = 'review'
);

alter table public.activity_logs enable row level security;

create policy "activity_logs_select_admin"
on public.activity_logs
for select
to authenticated
using (public.is_admin());

create policy "activity_logs_manage_admin"
on public.activity_logs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
