create extension if not exists pg_cron with schema extensions;

create or replace function public.cleanup_ai_rate_limits(
  p_retention interval default interval '30 days'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if p_retention <= interval '0 seconds' then
    raise exception 'Retention interval must be positive';
  end if;

  with deleted as (
    delete from public.ai_rate_limits
    where updated_at < now() - p_retention
    returning 1
  )
  select count(*)::integer into deleted_count
  from deleted;

  return coalesce(deleted_count, 0);
end;
$$;

grant execute on function public.cleanup_ai_rate_limits(interval) to postgres, service_role;

create or replace view public.ai_rate_limit_route_metrics as
select
  route,
  count(*) filter (where updated_at >= now() - interval '1 hour')::bigint as windows_last_hour,
  count(*) filter (where updated_at >= now() - interval '24 hours')::bigint as windows_last_24_hours,
  coalesce(sum(request_count) filter (where updated_at >= now() - interval '1 hour'), 0)::bigint as requests_last_hour,
  coalesce(sum(request_count) filter (where updated_at >= now() - interval '24 hours'), 0)::bigint as requests_last_24_hours,
  coalesce(max(request_count), 0)::integer as max_requests_in_window,
  max(updated_at) as last_seen_at
from public.ai_rate_limits
group by route;

grant select on public.ai_rate_limit_route_metrics to authenticated;

create or replace view public.ai_rate_limit_cleanup_job_status as
select
  job.jobid,
  job.jobname,
  job.schedule,
  job.command,
  details.status as last_run_status,
  details.start_time as last_run_started_at,
  details.end_time as last_run_finished_at,
  details.return_message as last_run_message
from cron.job as job
left join lateral (
  select
    job_run_details.status,
    job_run_details.start_time,
    job_run_details.end_time,
    job_run_details.return_message
  from cron.job_run_details
  where job_run_details.jobid = job.jobid
  order by job_run_details.start_time desc
  limit 1
) as details on true
where job.jobname = 'cleanup-ai-rate-limits';

grant select on public.ai_rate_limit_cleanup_job_status to authenticated;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'cleanup-ai-rate-limits'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'cleanup-ai-rate-limits',
    '17 3 * * *',
    $job$
      select public.cleanup_ai_rate_limits(interval '30 days');
    $job$
  );
end;
$$;
