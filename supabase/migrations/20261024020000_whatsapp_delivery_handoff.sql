-- Delivery messages are manually sent through WhatsApp. The OTP is visible only
-- to authenticated administrators and is cleared when delivery is confirmed.
ALTER TABLE public.print_orders ADD COLUMN IF NOT EXISTS whatsapp_shared_at timestamptz;
UPDATE public.print_orders SET delivery_otp_sent_at = NULL WHERE delivery_otp_sent_at IS NOT NULL;
