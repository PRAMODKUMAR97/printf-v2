-- Delivery OTPs are sent only by SMS.  Keep a hash server-side; never expose
-- the code in database reads or to the browser.
ALTER TABLE public.print_orders
  ADD COLUMN IF NOT EXISTS delivery_otp_hash text,
  ADD COLUMN IF NOT EXISTS delivery_otp_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_otp_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE public.print_orders
  DROP CONSTRAINT IF EXISTS print_orders_delivery_otp_attempts_check;
ALTER TABLE public.print_orders
  ADD CONSTRAINT print_orders_delivery_otp_attempts_check
  CHECK (delivery_otp_attempts >= 0 AND delivery_otp_attempts <= 5);

-- Remove any old browser-visible delivery code immediately.
UPDATE public.print_orders SET delivery_otp = NULL WHERE delivery_otp IS NOT NULL;

CREATE OR REPLACE FUNCTION public.expire_delivery_otp_on_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.order_status = 'completed' AND OLD.order_status IS DISTINCT FROM 'completed' THEN
    NEW.delivery_otp = NULL;
    NEW.delivery_otp_hash = NULL;
    NEW.delivery_otp_attempts = 0;
    NEW.delivery_otp_expires_at = now();
  END IF;
  RETURN NEW;
END;
$$;
