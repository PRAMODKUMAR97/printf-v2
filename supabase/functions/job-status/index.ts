import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_COLUMNS = "id, printf_id, file_name, file_size, settings_json, status, locked, expiry_time, created_at, updated_at";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  try {
    const { job_id } = await req.json().catch(() => ({}));
    if (typeof job_id !== "string" || !UUID_RE.test(job_id)) {
      return new Response(JSON.stringify({ error: "A valid job_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const supabase = createClient(url, serviceKey);
    const { data, error } = await supabase.from("print_jobs").select(SAFE_COLUMNS).eq("id", job_id).maybeSingle();
    if (error) {
      console.error("job-status query failed:", error.message);
      return new Response(JSON.stringify({ error: "Unable to load job status" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data) return new Response(JSON.stringify({ error: "Job not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const row = data as Record<string, unknown>;
    if (row.status === "ready" && !row.locked && new Date(row.expiry_time as string).getTime() < Date.now()) {
      const { error: expireError } = await supabase.from("print_jobs").update({ status: "expired", locked: false })
        .eq("id", job_id).eq("status", "ready").eq("locked", false);
      if (!expireError) row.status = "expired";
    }
    return new Response(JSON.stringify({ job: row }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("job-status failed:", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});