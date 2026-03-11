create table public.ai_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, route, window_start)
);

create index ai_rate_limits_updated_at_idx
on public.ai_rate_limits (updated_at);

alter table public.ai_rate_limits enable row level security;

create or replace function public.check_ai_rate_limit(
  p_route text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  request_count integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_window_start timestamptz;
  next_request_count integer;
  next_retry_after_seconds integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(length(trim(p_route)), 0) = 0 then
    raise exception 'Route is required';
  end if;

  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'Invalid rate limit configuration';
  end if;

  current_window_start :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.ai_rate_limits (user_id, route, window_start, request_count, updated_at)
  values (current_user_id, p_route, current_window_start, 1, now())
  on conflict (user_id, route, window_start)
  do update
    set request_count = public.ai_rate_limits.request_count + 1,
        updated_at = now()
  returning public.ai_rate_limits.request_count into next_request_count;

  next_retry_after_seconds :=
    greatest(
      1,
      ceil(
        extract(
          epoch from (current_window_start + make_interval(secs => p_window_seconds) - now())
        )
      )::integer
    );

  return query
  select
    next_request_count <= p_limit,
    next_request_count,
    case
      when next_request_count <= p_limit then 0
      else next_retry_after_seconds
    end;
end;
$$;

grant execute on function public.check_ai_rate_limit(text, integer, integer) to authenticated;
