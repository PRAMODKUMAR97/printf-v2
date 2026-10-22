import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    let action = typeof body.action === "string" ? body.action : "";
    if (!action) action = body.razorpay_signature ? "verify" : "create";
    const destination = action === "create" ? "create-order" : action === "verify" ? "verify-payment" : "";
    if (!destination) return json({ error: "Action must be create or verify" }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Server configuration error" }, 500);

    const { action: _action, ...payload } = body;
    const upstream = await fetch(`${url}/functions/v1/${destination}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
    });
    const raw = await upstream.text();
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = { error: "Invalid response from payment service" }; }
    return json(parsed, upstream.status);
  } catch (e) {
    console.error("secure-payment failed:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Invalid request or internal server error" }, 500);
  }
});