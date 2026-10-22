import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(data: unknown, status = 410) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  return json({
    error: "Cashfree is disabled for PrintF v2. This project uses Razorpay and Cash on Delivery.",
    deprecated: true,
    replacement: "create-order",
    message: "Do not route checkout traffic to Cashfree. Use create-order and verify-payment.",
  });
});