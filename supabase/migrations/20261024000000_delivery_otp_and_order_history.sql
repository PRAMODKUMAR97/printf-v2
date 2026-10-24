-- A short handoff code is shown to the customer after an order is placed.
-- It is cleared as soon as the operator records a completed delivery.
ALTER TABLE public.print_orders
  ADD COLUMN IF NOT EXISTS delivery_otp text,
  ADD COLUMN IF NOT EXISTS delivery_otp_expires_at timestamptz;

ALTER TABLE public.print_orders
  DROP CONSTRAINT IF EXISTS print_orders_delivery_otp_check;
ALTER TABLE public.print_orders
  ADD CONSTRAINT print_orders_delivery_otp_check
  CHECK (delivery_otp IS NULL OR delivery_otp ~ '^[0-9]{4}$');

CREATE INDEX IF NOT EXISTS print_orders_customer_mobile_created_idx
  ON public.print_orders (customer_mobile, created_at DESC);

CREATE OR REPLACE FUNCTION public.expire_delivery_otp_on_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.order_status = 'completed' AND OLD.order_status IS DISTINCT FROM 'completed' THEN
    NEW.delivery_otp = NULL;
    NEW.delivery_otp_expires_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expire_delivery_otp_on_completion ON public.print_orders;
CREATE TRIGGER expire_delivery_otp_on_completion
  BEFORE UPDATE OF order_status ON public.print_orders
  FOR EACH ROW EXECUTE FUNCTION public.expire_delivery_otp_on_completion();
