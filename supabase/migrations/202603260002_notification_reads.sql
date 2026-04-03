create table if not exists public.notification_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  notification_id text not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, notification_id)
);

create index if not exists notification_reads_user_id_read_at_idx
  on public.notification_reads (user_id, read_at desc);

alter table public.notification_reads enable row level security;

drop policy if exists notification_reads_select_self on public.notification_reads;
create policy notification_reads_select_self
on public.notification_reads
for select
using (user_id = auth.uid());

drop policy if exists notification_reads_insert_self on public.notification_reads;
create policy notification_reads_insert_self
on public.notification_reads
for insert
with check (user_id = auth.uid());

drop policy if exists notification_reads_update_self on public.notification_reads;
create policy notification_reads_update_self
on public.notification_reads
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notification_reads_delete_self on public.notification_reads;
create policy notification_reads_delete_self
on public.notification_reads
for delete
using (user_id = auth.uid());
