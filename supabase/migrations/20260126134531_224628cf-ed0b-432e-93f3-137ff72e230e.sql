-- Drop the existing view
DROP VIEW IF EXISTS public.printfs_public;

-- Recreate the view WITHOUT security_invoker so it uses definer permissions
-- This allows anonymous users to read printer info through the view
CREATE VIEW public.printfs_public AS
SELECT 
    id,
    name,
    location,
    status,
    ink_level,
    paper_level,
    last_seen,
    created_at,
    updated_at
FROM public.printfs;

-- Grant SELECT access to anon and authenticated roles
GRANT SELECT ON public.printfs_public TO anon;
GRANT SELECT ON public.printfs_public TO authenticated;