-- Let an open administrator dashboard receive new-order notifications.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'print_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.print_orders;
  END IF;
END;
$$;
