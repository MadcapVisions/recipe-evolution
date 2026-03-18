revoke select on public.ai_rate_limit_route_metrics from authenticated;
revoke select on public.ai_rate_limit_cleanup_job_status from authenticated;

alter view public.ai_rate_limit_route_metrics
  set (security_invoker = true);

alter view public.ai_rate_limit_cleanup_job_status
  set (security_invoker = true);
