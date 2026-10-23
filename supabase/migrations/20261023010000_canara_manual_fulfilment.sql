-- Manual-fulfilment stations can accept paid orders independently of a live printer agent.
-- Canara Engineering College orders are printed and delivered by an operator.
ALTER TABLE public.printfs
  ADD COLUMN IF NOT EXISTS accepts_orders_24_7 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_fulfilment boolean NOT NULL DEFAULT false;

UPDATE public.printfs
SET accepts_orders_24_7 = true,
    manual_fulfilment = true
WHERE lower(trim(name)) = 'canara engineering college';

DROP VIEW IF EXISTS public.printfs_public;

CREATE VIEW public.printfs_public AS
SELECT
  id, name, location, status, ink_level, paper_level, last_seen,
  accepts_orders_24_7, manual_fulfilment, created_at, updated_at
FROM public.printfs;

GRANT SELECT ON public.printfs_public TO anon, authenticated;
