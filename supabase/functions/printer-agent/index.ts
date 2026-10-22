import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-printf-id, x-api-key",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOB_COLUMNS = "id, printf_id, file_name, file_size, settings_json, status, locked, expiry_time, created_at";
const ALLOWED_STATUS = ["printing", "completed", "failed"];
const ALLOWED_LOG_TYPES = ["info", "success", "error", "warning"];
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration error" }, 500);
  try {
    const printfId = req.headers.get("x-printf-id") ?? "";
    const apiKey = req.headers.get("x-api-key") ?? "";
    if (!UUID_RE.test(printfId) || apiKey.length < 8 || apiKey.length > 200) return json({ error: "Invalid device credentials" }, 401);
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: station, error: stationError } = await supabase.from("printfs")
      .select("id, name, api_key, status").eq("id", printfId).maybeSingle();
    if (stationError || !station || station.api_key !== apiKey) return json({ error: "Invalid device credentials" }, 401);
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";
    switch (action) {
      case "authenticate":
        return json({ success: true, station: { id: station.id, name: station.name, status: station.status } });
      case "heartbeat": {
        const update: Record<string, unknown> = { status: body.status === "offline" ? "offline" : "online", last_seen: new Date().toISOString() };
        if (Number.isInteger(body.paper_level) && body.paper_level >= 0 && body.paper_level <= 100) update.paper_level = body.paper_level;
        if (Number.isInteger(body.ink_level) && body.ink_level >= 0 && body.ink_level <= 100) update.ink_level = body.ink_level;
        const { error } = await supabase.from("printfs").update(update).eq("id", printfId);
        if (error) return json({ error: "Heartbeat failed" }, 500);
        return json({ success: true });
      }
      case "poll": {
        const now = new Date().toISOString();
        await supabase.from("print_jobs").update({ status: "expired", locked: false })
          .eq("status", "ready").eq("locked", false).lt("expiry_time", now);
        const { data: assigned, error } = await supabase.from("print_jobs").select(JOB_COLUMNS)
          .eq("printf_id", printfId).eq("status", "ready").eq("locked", false).gt("expiry_time", now).order("created_at");
        if (error) return json({ error: "Failed to poll jobs" }, 500);
        if (assigned && assigned.length > 0) return json({ jobs: assigned });
        const { data: unassigned, error: unassignedError } = await supabase.from("print_jobs").select("id")
          .is("printf_id", null).eq("status", "ready").eq("locked", false).gt("expiry_time", now).order("created_at");
        if (unassignedError) return json({ error: "Failed to locate unassigned jobs" }, 500);
        if (!unassigned || unassigned.length === 0) return json({ jobs: [] });
        const ids = unassigned.map((job) => job.id);
        const { data: claimed, error: claimError } = await supabase.from("print_jobs").update({ printf_id: printfId })
          .in("id", ids).is("printf_id", null).select(JOB_COLUMNS);
        if (claimError) return json({ error: "Failed to claim jobs" }, 500);
        return json({ jobs: claimed ?? [] });
      }
      case "lock": {
        if (!UUID_RE.test(body.job_id ?? "")) return json({ error: "Invalid job_id" }, 400);
        const now = new Date().toISOString();
        const { data, error } = await supabase.from("print_jobs").update({ locked: true, status: "printing" })
          .eq("id", body.job_id).eq("printf_id", printfId).eq("locked", false).eq("status", "ready").gt("expiry_time", now).select("id");
        if (error) return json({ error: "Failed to lock job" }, 500);
        if (!data || data.length === 0) {
          await supabase.from("print_jobs").update({ status: "expired", locked: false })
            .eq("id", body.job_id).eq("status", "ready").lt("expiry_time", now);
          return json({ locked: false, expired: true });
        }
        return json({ locked: true });
      }
      case "update_job": {
        if (!UUID_RE.test(body.job_id ?? "")) return json({ error: "Invalid job_id" }, 400);
        if (!ALLOWED_STATUS.includes(body.status)) return json({ error: "Invalid status" }, 400);
        const { data: updated, error } = await supabase.from("print_jobs").update({ status: body.status, locked: false })
          .eq("id", body.job_id).eq("printf_id", printfId).select("id").maybeSingle();
        if (error) return json({ error: "Failed to update job" }, 500);
        if (!updated) return json({ error: "Job is not assigned to this station" }, 404);
        return json({ success: true });
      }
      case "file_url": {
        if (!UUID_RE.test(body.job_id ?? "")) return json({ error: "Invalid job_id" }, 400);
        const { data: job, error: jobError } = await supabase.from("print_jobs")
          .select("id, file_path, file_name, status, expiry_time").eq("id", body.job_id).eq("printf_id", printfId).maybeSingle();
        if (jobError || !job) return json({ error: "Job not found for this station" }, 404);
        if (job.status === "expired" || new Date(job.expiry_time).getTime() < Date.now()) return json({ error: "Job expired" }, 410);
        const { data: signed, error: signedError } = await supabase.storage.from("print-files").createSignedUrl(job.file_path, 120);
        if (signedError || !signed) return json({ error: "Failed to create download link" }, 500);
        return json({ signed_url: signed.signedUrl, file_name: job.file_name });
      }
      case "log": {
        const message = typeof body.message === "string" ? body.message.slice(0, 500) : "";
        if (!message) return json({ error: "message is required" }, 400);
        const type = ALLOWED_LOG_TYPES.includes(body.type) ? body.type : "info";
        const jobId = UUID_RE.test(body.job_id ?? "") ? body.job_id : null;
        const { error } = await supabase.from("logs").insert({
          type, message, printf_id: printfId, job_id: jobId,
          metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
        });
        if (error) return json({ error: "Could not record log" }, 500);
        return json({ success: true });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (error) {
    console.error("printer-agent failed:", error instanceof Error ? error.message : "unknown");
    return json({ error: "Invalid request or internal server error" }, 500);
  }
});