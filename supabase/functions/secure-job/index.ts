import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function encodeToken(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
async function sha256(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((value) => value.toString(16).padStart(2, "0")).join("");
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "";
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Server configuration error" }, 500);
    const supabase = createClient(url, serviceKey);

    if (action === "issue") {
      const jobId = typeof body.job_id === "string" ? body.job_id : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!UUID_RE.test(jobId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
        return json({ error: "A valid job_id and email are required" }, 400);
      // An OTP row can be marked used when a newer OTP is sent, so "used=true"
      // alone is not proof of verification. Requiring the order's accepted state ensures
      // secure-otp has successfully verified the customer before access is granted.
      const { data: order, error: orderError } = await supabase.from("print_orders")
        .select("id, customer_email, order_status")
        .eq("print_job_id", jobId).eq("order_status", "accepted")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (orderError) {
        console.error("secure-job order verification lookup failed:", orderError.message);
        return json({ error: "Could not validate the print order" }, 500);
      }
      if (!order) return json({ error: "Verify your email OTP before requesting job access" }, 401);
      if (!order.customer_email || order.customer_email.trim().toLowerCase() !== email)
        return json({ error: "This email does not match the verified print order" }, 403);
      const { data: job, error } = await supabase.from("print_jobs").select("id, status, expiry_time").eq("id", jobId).maybeSingle();
      if (error || !job) return json({ error: "Print job not found" }, 404);
      if (["expired", "failed"].includes(job.status) || new Date(job.expiry_time).getTime() < Date.now())
        return json({ error: "Print job is no longer available" }, 410);
      const raw = new Uint8Array(32);
      crypto.getRandomValues(raw);
      const token = encodeToken(raw);
      const jobExpiry = new Date(job.expiry_time).getTime();
      if (!Number.isFinite(jobExpiry) || jobExpiry <= Date.now())
        return json({ error: "Print job is no longer available" }, 410);
      const expiresAt = new Date(Math.min(Date.now() + 24 * 60 * 60 * 1000, jobExpiry)).toISOString();
      const { error: saveError } = await supabase.from("job_tokens").upsert({
        job_id: jobId, token_hash: await sha256(token), expires_at: expiresAt, used: false,
      }, { onConflict: "job_id" });
      if (saveError) {
        console.error("secure-job token save failed:", saveError.message);
        return json({ error: "Could not create secure job token" }, 500);
      }
      return json({ success: true, access_token: token, expires_at: expiresAt });
    }

    if (action !== "status" && action !== "download")
      return json({ error: "Action must be issue, status, or download" }, 400);
    const token = typeof body.access_token === "string" ? body.access_token : "";
    if (token.length < 32 || token.length > 200) return json({ error: "Valid access_token is required" }, 401);
    const { data: record, error: tokenError } = await supabase.from("job_tokens")
      .select("id, job_id, expires_at, used").eq("token_hash", await sha256(token)).maybeSingle();
    if (tokenError || !record || record.used || new Date(record.expires_at).getTime() < Date.now())
      return json({ error: "Job token is invalid, expired, or already used" }, 401);
    const { data: job, error: jobError } = await supabase.from("print_jobs")
      .select("id, printf_id, file_name, file_size, settings_json, status, locked, expiry_time, created_at, updated_at, file_path")
      .eq("id", record.job_id).maybeSingle();
    if (jobError || !job) return json({ error: "Print job not found" }, 404);
    const jobExpiry = new Date(job.expiry_time).getTime();
    const isExpired = job.status === "expired" ||
      (!["completed", "failed", "printing"].includes(job.status) &&
       (!Number.isFinite(jobExpiry) || jobExpiry < Date.now()));
    if (action === "status") {
      // Return only what the customer status screen needs; keep station IDs, file paths,
      // file sizes, and other operational fields private. Expired jobs remain viewable.
      const safeJob = {
        id: job.id,
        file_name: job.file_name,
        settings_json: job.settings_json,
        status: isExpired ? "expired" : job.status,
        locked: job.locked,
        expiry_time: job.expiry_time,
        created_at: job.created_at,
        updated_at: job.updated_at,
      };
      return json({ job: safeJob, expires_at: record.expires_at });
    }
    if (isExpired) return json({ error: "Print job has expired" }, 410);
    if (!["ready", "printing", "completed"].includes(job.status))
      return json({ error: "Job is not released for download" }, 409);
    const { data: signed, error: signedError } = await supabase.storage.from("print-files").createSignedUrl(job.file_path, 120);
    if (signedError || !signed) return json({ error: "Could not create download URL" }, 500);
    const { data: consumed, error: consumeError } = await supabase.from("job_tokens")
      .update({ used: true }).eq("id", record.id).eq("used", false).select("id").maybeSingle();
    if (consumeError) return json({ error: "Could not consume secure job token" }, 500);
    if (!consumed) return json({ error: "This download token has already been used" }, 409);
    return json({ signed_url: signed.signedUrl, file_name: job.file_name, expires_in_seconds: 120 });
  } catch (error) {
    console.error("secure-job failed:", error instanceof Error ? error.message : "unknown");
    return json({ error: "Invalid request or internal server error" }, 500);
  }
});