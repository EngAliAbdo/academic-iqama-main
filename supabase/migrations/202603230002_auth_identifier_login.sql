create or replace function public.resolve_login_identifier(lookup_identifier text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select profile.email
  from public.profiles as profile
  where lower(profile.email) = lower(trim(lookup_identifier))
    or lower(profile.academic_id) = lower(trim(lookup_identifier))
    or lower(coalesce(profile.employee_number, '')) = lower(trim(lookup_identifier))
  order by
    case
      when lower(profile.email) = lower(trim(lookup_identifier)) then 1
      when lower(profile.academic_id) = lower(trim(lookup_identifier)) then 2
      when lower(coalesce(profile.employee_number, '')) = lower(trim(lookup_identifier)) then 3
      else 4
    end
  limit 1
$$;

revoke all on function public.resolve_login_identifier(text) from public;
grant execute on function public.resolve_login_identifier(text) to anon;
grant execute on function public.resolve_login_identifier(text) to authenticated;
