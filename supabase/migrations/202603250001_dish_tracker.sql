create table if not exists public.dish_tracker_items (
  key text primary key,
  checked boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.dish_tracker_items enable row level security;

create policy "dish_tracker_public_select" on public.dish_tracker_items for select using (true);
create policy "dish_tracker_public_insert" on public.dish_tracker_items for insert with check (true);
create policy "dish_tracker_public_update" on public.dish_tracker_items for update using (true);

alter publication supabase_realtime add table public.dish_tracker_items;
