import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Server configuration error" }, 500);
    const supabase = createClient(url, key);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const requestedStatus = new URL(req.url).searchParams.get("status") ?? body.status;
    let query = supabase.from("printfs_public")
      .select("id, name, location, status, ink_level, paper_level, last_seen, created_at, updated_at")
      .order("name", { ascending: true }).limit(100);
    if (["online", "offline", "maintenance"].includes(requestedStatus)) query = query.eq("status", requestedStatus);
    const { data, error } = await query;
    if (error) {
      console.error("public-printfs query failed:", error.message);
      return json({ error: "Unable to load printer stations" }, 500);
    }
    return json({ stations: data ?? [], count: data?.length ?? 0 });
  } catch (e) {
    console.error("public-printfs failed:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Invalid request or internal server error" }, 500);
  }
});