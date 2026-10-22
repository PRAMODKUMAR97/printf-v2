import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-printf-id, x-api-key",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const stationId = req.headers.get("x-printf-id") ?? body.printf_id ?? "";
    const apiKey = req.headers.get("x-api-key") ?? body.api_key ?? "";
    if (typeof stationId !== "string" || !UUID_RE.test(stationId) ||
        typeof apiKey !== "string" || apiKey.length < 8 || apiKey.length > 200) {
      return json({ error: "Invalid station credentials" }, 401);
    }
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Server configuration error" }, 500);
    const supabase = createClient(url, serviceKey);
    const { data: station, error } = await supabase.from("printfs")
      .select("id, name, status, api_key").eq("id", stationId).maybeSingle();
    if (error || !station || station.api_key !== apiKey) return json({ error: "Invalid station credentials" }, 401);
    const now = new Date().toISOString();
    await supabase.from("printfs").update({ last_seen: now, status: "online" }).eq("id", stationId);
    await supabase.from("printer_devices").update({ last_authenticated: now, is_active: true }).eq("printf_id", stationId);
    return json({ success: true, authenticated: true, station: { id: station.id, name: station.name, status: "online" } });
  } catch (e) {
    console.error("printer-auth failed:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Invalid request or internal server error" }, 500);
  }
});