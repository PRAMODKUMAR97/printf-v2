-- Keep anonymous PostgREST/GraphQL access limited to the deliberately public printer listing.
-- Edge Functions use service_role for protected order/job operations; customer status now uses scoped tokens.

REVOKE ALL PRIVILEGES ON TABLE
  public.job_tokens,
  public.logs,
  public.otps,
  public.payments,
  public.print_jobs,
  public.print_orders,
  public.printer_devices,
  public.profiles,
  public.rate_limits,
  public.user_roles
FROM anon;

-- The public station view is security_invoker=true, so allow anon to read only its
-- curated columns from the backing table (never the API key or station secrets).
REVOKE ALL PRIVILEGES ON TABLE public.printfs FROM anon;
GRANT SELECT (id, name, location, status, ink_level, paper_level, last_seen, created_at, updated_at)
  ON TABLE public.printfs TO anon;
GRANT SELECT ON TABLE public.printfs_public TO anon;

-- has_role is used by authenticated RLS policies; its body independently denies
-- cross-user lookup and anonymous calls. Remove default PUBLIC/anon execution.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
