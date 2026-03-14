do $$
declare
  constraint_name text;
begin
  select con.conname
  into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'ai_cache'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%purpose%';

  if constraint_name is not null then
    execute format('alter table public.ai_cache drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.ai_cache
add constraint ai_cache_purpose_check
check (purpose in ('structure', 'refine', 'home_ideas', 'home_recipe'));
