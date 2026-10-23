-- PrintF V2 security hardening and active-order idempotency.
-- Safe for existing order/job records: no user data is rewritten or deleted.

CREATE UNIQUE INDEX IF NOT EXISTS print_orders_one_active_order_per_job_idx
  ON public.print_orders (print_job_id)
  WHERE print_job_id IS NOT NULL
    AND order_status NOT IN ('cancelled', 'failed');

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id = auth.uid() OR auth.role() = 'service_role'
      THEN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
      )
    ELSE false
  END
$function$;

-- The browser calls this only for the currently signed-in user. Do not permit role
-- enumeration for arbitrary user UUIDs.
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND (_user_id = auth.uid() OR auth.role() = 'service_role')
  LIMIT 1
$function$;

-- Only the application can call the role lookup, and it can inspect its own role.
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;

-- These helpers are used by triggers/maintenance or have no client-side use. They
-- should not be exposed as callable PostgREST RPCs.
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_tokens() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_tokens() TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hash_secret(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_secret(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
