create table if not exists public.feature_flags (
  key text primary key,
  value boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_feature_flags_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists feature_flags_updated_at on public.feature_flags;
create trigger feature_flags_updated_at
before update on public.feature_flags
for each row
execute function public.set_feature_flags_updated_at();

alter table public.feature_flags enable row level security;

drop policy if exists "feature_flags_no_client_access" on public.feature_flags;
create policy "feature_flags_no_client_access"
on public.feature_flags
for all
to authenticated
using (false)
with check (false);

insert into public.feature_flags (key, value)
values ('graceful_mode', false)
on conflict (key) do nothing;
