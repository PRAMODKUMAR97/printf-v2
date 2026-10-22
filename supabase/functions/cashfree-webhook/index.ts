import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp",
};
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  return new Response(JSON.stringify({
    error: "Cashfree webhook processing is disabled for PrintF v2. Payments must be made through Razorpay.",
    deprecated: true,
    replacement: "verify-payment",
    accepted: false,
  }), {
    status: 410,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});