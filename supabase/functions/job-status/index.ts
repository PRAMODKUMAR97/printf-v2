import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.access_token === "string" ? body.access_token : "";
    if (token.length < 32 || token.length > 200) {
      return json({ error: "A valid job access token is required" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Server configuration error" }, 500);
    const supabase = createClient(url, serviceKey);

    const { data: access, error: tokenError } = await supabase.from("job_tokens")
      .select("job_id, expires_at, used")
      .eq("token_hash", await sha256(token))
      .maybeSingle();
    if (tokenError) {
      console.error("job-status token lookup failed:", tokenError.message);
      return json({ error: "Unable to validate job access" }, 500);
    }
    if (!access || access.used || new Date(access.expires_at).getTime() <= Date.now()) {
      return json({ error: "Job access token is invalid or expired" }, 401);
    }

    const { data, error } = await supabase.from("print_jobs")
      .select("id, file_name, settings_json, status, locked, expiry_time, created_at, updated_at")
      .eq("id", access.job_id)
      .maybeSingle();
    if (error) {
      console.error("job-status query failed:", error.message);
      return json({ error: "Unable to load job status" }, 500);
    }
    if (!data) return json({ error: "Job not found" }, 404);

    const job = { ...data };
    const expiry = new Date(job.expiry_time).getTime();
    if (Number.isFinite(expiry) && expiry <= Date.now() && ["pending", "ready"].includes(job.status)) {
      job.status = "expired";
    }
    return json({ job, expires_at: access.expires_at });
  } catch (error) {
    console.error("job-status failed:", error instanceof Error ? error.message : "unknown");
    return json({ error: "Internal server error" }, 500);
  }
});