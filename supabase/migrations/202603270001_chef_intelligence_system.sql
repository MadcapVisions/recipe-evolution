create table if not exists public.chef_rules (
  id text primary key,
  title text not null,
  category text not null,
  trigger_conditions jsonb not null default '{}'::jsonb,
  rule_type text not null check (rule_type in ('mandatory', 'recommended', 'warning')),
  rule_text text not null,
  priority integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_analysis (
  recipe_version_id uuid primary key references public.recipe_versions(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  analysis_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chef_score_profiles (
  recipe_category text primary key,
  flavor_weight integer not null default 20,
  technique_weight integer not null default 20,
  texture_weight integer not null default 15,
  harmony_weight integer not null default 15,
  clarity_weight integer not null default 10,
  risk_weight integer not null default 10,
  extras_weight integer not null default 10,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_scores (
  recipe_version_id uuid primary key references public.recipe_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  total_score integer not null,
  flavor_score integer not null,
  technique_score integer not null,
  texture_score integer not null,
  harmony_score integer not null,
  clarity_score integer not null,
  risk_score integer not null,
  extras_score integer not null,
  score_band text not null,
  summary text not null,
  improvement_priorities jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_score_factors (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references public.recipe_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  factor_type text not null,
  factor_key text not null,
  impact integer not null,
  explanation text not null,
  bucket text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chef_fix_strategies (
  issue_key text primary key,
  category text not null,
  title text not null,
  description text not null,
  fix_action_type text not null,
  action_template jsonb not null,
  expected_score_impact integer not null default 0,
  priority integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_fix_sessions (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references public.recipe_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('previewed','applied','dismissed')),
  projected_score_delta integer not null default 0,
  selected_fixes jsonb not null default '[]'::jsonb,
  created_recipe_version_id uuid references public.recipe_versions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_fix_actions (
  id uuid primary key default gen_random_uuid(),
  fix_session_id uuid not null references public.recipe_fix_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  action_payload jsonb not null,
  rationale text not null,
  estimated_impact integer not null default 0,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_recipe_analysis_owner on public.recipe_analysis(owner_id);
create index if not exists idx_recipe_scores_owner on public.recipe_scores(owner_id);
create index if not exists idx_recipe_score_factors_version on public.recipe_score_factors(recipe_version_id);
create index if not exists idx_recipe_fix_sessions_version on public.recipe_fix_sessions(recipe_version_id);

alter table public.chef_rules enable row level security;
alter table public.recipe_analysis enable row level security;
alter table public.chef_score_profiles enable row level security;
alter table public.recipe_scores enable row level security;
alter table public.recipe_score_factors enable row level security;
alter table public.chef_fix_strategies enable row level security;
alter table public.recipe_fix_sessions enable row level security;
alter table public.recipe_fix_actions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chef_rules' and policyname = 'chef_rules_read_authenticated') then
    create policy chef_rules_read_authenticated on public.chef_rules for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chef_score_profiles' and policyname = 'chef_score_profiles_read_authenticated') then
    create policy chef_score_profiles_read_authenticated on public.chef_score_profiles for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chef_fix_strategies' and policyname = 'chef_fix_strategies_read_authenticated') then
    create policy chef_fix_strategies_read_authenticated on public.chef_fix_strategies for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recipe_analysis' and policyname = 'recipe_analysis_owner_all') then
    create policy recipe_analysis_owner_all on public.recipe_analysis for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recipe_scores' and policyname = 'recipe_scores_owner_all') then
    create policy recipe_scores_owner_all on public.recipe_scores for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recipe_score_factors' and policyname = 'recipe_score_factors_owner_all') then
    create policy recipe_score_factors_owner_all on public.recipe_score_factors for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recipe_fix_sessions' and policyname = 'recipe_fix_sessions_owner_all') then
    create policy recipe_fix_sessions_owner_all on public.recipe_fix_sessions for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recipe_fix_actions' and policyname = 'recipe_fix_actions_owner_all') then
    create policy recipe_fix_actions_owner_all on public.recipe_fix_actions for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
end $$;

insert into public.chef_score_profiles (
  recipe_category,
  flavor_weight,
  technique_weight,
  texture_weight,
  harmony_weight,
  clarity_weight,
  risk_weight,
  extras_weight
) values
  ('general', 20, 20, 15, 15, 10, 10, 10),
  ('cookies', 20, 20, 15, 15, 10, 10, 10),
  ('baking', 20, 20, 15, 15, 10, 10, 10),
  ('protein', 20, 20, 15, 15, 10, 10, 10),
  ('chicken', 20, 20, 15, 15, 10, 10, 10),
  ('pasta', 20, 20, 15, 15, 10, 10, 10),
  ('grains', 20, 20, 15, 15, 10, 10, 10),
  ('sauce', 20, 20, 15, 15, 10, 10, 10)
on conflict (recipe_category) do nothing;

insert into public.chef_fix_strategies (
  issue_key,
  category,
  title,
  description,
  fix_action_type,
  action_template,
  expected_score_impact,
  priority
) values
  ('cookie_chill_step_missing', 'reliability', 'Add a dough chilling step', 'This reduces spread and improves texture consistency.', 'add_step', '[{"type":"add_step","stepPosition":"before_baking","content":"Refrigerate the dough for 30 to 60 minutes before baking.","rationale":"Cold dough spreads less and bakes more evenly."}]'::jsonb, 8, 10),
  ('vague_cookie_doneness', 'teaching', 'Add a clear doneness cue', 'A sensory cue prevents overbaking and teaches the cook what to look for.', 'insert_doneness_cue', '[{"type":"insert_doneness_cue","content":"Bake until the edges are set and lightly golden while the centers still look slightly soft.","rationale":"The clock alone is not enough for reliable cookie texture."}]'::jsonb, 5, 8),
  ('cookie_cooling_step_missing', 'reliability', 'Add a cooling step', 'Cookies finish setting on the tray.', 'add_step', '[{"type":"add_step","stepPosition":"after_baking","content":"Let the cookies cool on the tray for 5 minutes before moving them to a rack.","rationale":"Cooling stabilizes the structure before handling."}]'::jsonb, 4, 6),
  ('non_dairy_spread_risk', 'quality', 'Call out non-dairy fat behavior', 'Non-dairy fats soften quickly and need colder handling.', 'add_note', '[{"type":"add_note","content":"Non-dairy fats soften quickly, so keep the dough cold and bake on parchment for better structure.","rationale":"This warns the cook about the main spread risk."}]'::jsonb, 4, 7),
  ('sourdough_balance_missing', 'quality', 'Balance the sourdough tang', 'Sourdough discard varies in acidity and needs explicit balancing guidance.', 'add_chef_insight', '[{"type":"add_chef_insight","content":"If your discard tastes especially tangy, round it out with a touch more vanilla or a slight sugar increase.","rationale":"This helps the cook adapt to the acidity of their starter."}]'::jsonb, 4, 7),
  ('protein_temp_guidance_missing', 'reliability', 'Add internal temperature guidance', 'Specific temperature cues reduce safety and dryness mistakes.', 'insert_doneness_cue', '[{"type":"insert_doneness_cue","content":"Cook until the thickest part reaches the target internal temperature instead of relying on time alone.","rationale":"Temperature is the most reliable doneness check for protein."}]'::jsonb, 8, 10),
  ('chicken_rest_step_missing', 'reliability', 'Add a rest step', 'Resting keeps the protein juicier and easier to carve.', 'insert_rest_time', '[{"type":"insert_rest_time","content":"Rest for 10 minutes before carving so the juices stay in the meat.","rationale":"Resting improves texture and moisture retention."}]'::jsonb, 6, 8),
  ('dry_surface_prep_missing', 'reliability', 'Dry the protein before cooking', 'Dry surfaces brown better and crisp more easily.', 'add_step', '[{"type":"add_step","stepIndex":0,"content":"Pat the surface dry before seasoning and cooking.","rationale":"Moisture blocks browning and crisping."}]'::jsonb, 4, 7),
  ('sauce_reduction_missing', 'quality', 'Reduce the sauce further', 'Reduction concentrates flavor and improves body.', 'add_note', '[{"type":"add_note","content":"Simmer until the sauce coats the back of a spoon so it tastes concentrated instead of watery.","rationale":"Reduction gives the sauce enough body and intensity."}]'::jsonb, 5, 7),
  ('acid_finish_missing', 'quality', 'Add a finishing acid cue', 'A final acid note often fixes heaviness or flatness.', 'add_note', '[{"type":"add_note","content":"Taste before serving and add a squeeze of lemon or splash of vinegar if the dish needs brightness.","rationale":"A finishing acid can wake up a heavy or flat dish."}]'::jsonb, 4, 6),
  ('pasta_water_missing', 'reliability', 'Reserve pasta water', 'Pasta water is the simplest emulsifier for many sauces.', 'add_step', '[{"type":"add_step","stepPosition":"before_serving","content":"Reserve a cup of pasta water before draining and use it to loosen and emulsify the sauce.","rationale":"Starchy water helps the sauce cling instead of breaking."}]'::jsonb, 5, 7),
  ('grain_rest_missing', 'reliability', 'Add a grain resting step', 'Resting grains lets steam finish the texture evenly.', 'insert_rest_time', '[{"type":"insert_rest_time","content":"Cover and rest off the heat for 10 minutes before fluffing.","rationale":"The resting steam finishes hydration more evenly."}]'::jsonb, 4, 6),
  ('storage_tip_missing', 'teaching', 'Add storage guidance', 'Storage advice makes the recipe more usable beyond the first cook.', 'insert_storage_tip', '[{"type":"insert_storage_tip","content":"Store leftovers in an airtight container and refresh gently before serving again.","rationale":"Storage guidance improves repeatability and confidence."}]'::jsonb, 3, 4),
  ('make_ahead_tip_missing', 'teaching', 'Add a make-ahead note', 'Make-ahead cues help users plan better and cook with less stress.', 'insert_make_ahead_tip', '[{"type":"insert_make_ahead_tip","content":"This can be prepped ahead so the final cook is faster and more controlled.","rationale":"Make-ahead guidance teaches planning, not just execution."}]'::jsonb, 3, 4)
on conflict (issue_key) do nothing;
