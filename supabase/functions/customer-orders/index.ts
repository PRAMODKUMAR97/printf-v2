import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { mobile } = await request.json();
    const digits = typeof mobile === "string" ? mobile.replace(/\D/g, "") : "";
    if (digits.length < 10 || digits.length > 15) return json({ error: "Enter a valid mobile number" }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Server configuration error" }, 500);
    const supabase = createClient(url, serviceKey);
    const { data, error } = await supabase.from("print_orders")
      .select("order_number, amount, payment_status, order_status, created_at, delivery_otp_hash, delivery_otp_expires_at, print_jobs(file_name, settings_json)")
      .eq("customer_mobile", digits).order("created_at", { ascending: false }).limit(50);
    if (error) return json({ error: "Could not load orders" }, 500);

    const now = Date.now();
    const orders = (data ?? []).map(({ delivery_otp_hash, delivery_otp_expires_at, ...order }) => ({
      ...order,
      delivery_otp_active: order.order_status !== "completed" && Boolean(delivery_otp_hash) &&
        Boolean(delivery_otp_expires_at) && new Date(delivery_otp_expires_at).getTime() > now,
    }));
    return json({ success: true, orders });
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
});
