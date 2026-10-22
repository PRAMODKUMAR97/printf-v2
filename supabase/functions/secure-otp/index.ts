import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
async function hashOtp(jobId: string, email: string, code: string, pepper: string) {
  const input = new TextEncoder().encode(`${jobId}:${email}:${code}:${pepper}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest)).map((v) => v.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const action = body.action;
    const jobId = typeof body.job_id === "string" ? body.job_id : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!UUID_RE.test(jobId) || !EMAIL_RE.test(email) || email.length > 254) {
      return json({ error: "Valid job_id and email are required" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Server configuration error" }, 500);
    const supabase = createClient(url, serviceKey);

    if (action === "send" || action === "request") {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "PrintF <noreply@printfapp.site>";
      if (!resendKey) return json({ error: "Email OTP service is not configured" }, 503);

      const { data: order, error: orderLookupError } = await supabase.from("print_orders")
        .select("id, order_number, payment_method, payment_status, order_status, customer_email")
        .eq("print_job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (orderLookupError) {
        console.error("OTP order lookup failed:", orderLookupError.message);
        return json({ error: "Could not validate the print order" }, 500);
      }
      if (!order || order.order_status === "cancelled" || order.order_status === "failed") {
        return json({ error: "A valid print order is required before requesting an OTP" }, 404);
      }
      if (!order.customer_email || order.customer_email.trim().toLowerCase() !== email) {
        return json({ error: "This email does not match the print order" }, 403);
      }
      if (order.payment_method === "razorpay" && order.payment_status !== "paid") {
        return json({ error: "Verify the online payment before requesting the print OTP" }, 409);
      }
      if (order.payment_method === "cod" && !["pending", "paid"].includes(order.payment_status)) {
        return json({ error: "This Cash on Delivery order cannot be verified" }, 409);
      }

      const { data: job, error: jobError } = await supabase.from("print_jobs")
        .select("id, status, expiry_time").eq("id", jobId).maybeSingle();
      if (jobError || !job) return json({ error: "Print job not found" }, 404);
      if (["expired", "failed"].includes(job.status) || new Date(job.expiry_time).getTime() < Date.now()) {
        return json({ error: "Print job has expired" }, 410);
      }

      const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count, error: countError } = await supabase.from("otps")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId).ilike("email_address", email).gte("created_at", cutoff);
      if (countError) return json({ error: "Could not check OTP rate limit" }, 500);
      if ((count ?? 0) >= 3) return json({ error: "Too many OTP requests. Wait 10 minutes and try again." }, 429);

      const digits = new Uint32Array(1);
      crypto.getRandomValues(digits);
      const code = String(digits[0] % 1000000).padStart(6, "0");
      const pepper = serviceKey;
      const digest = await hashOtp(jobId, email, code, pepper);
      await supabase.from("otps").update({ used: true })
        .eq("job_id", jobId).ilike("email_address", email).eq("used", false);

      const { error: insertError } = await supabase.from("otps").insert({
        job_id: jobId,
        email_address: email,
        otp_code: "HASHED",
        otp_hash: digest,
        used: false,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        attempts: 0,
        max_attempts: 5,
      });
      if (insertError) {
        console.error("OTP record creation failed:", insertError.message);
        return json({ error: "Could not create OTP record" }, 500);
      }

      const mailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: "Your PrintF verification code",
          text: `Your PrintF verification code is ${code}. It expires in 5 minutes. Do not share this code.`,
          html: `<p>Your PrintF verification code is <strong style="font-size:24px;letter-spacing:4px">${code}</strong>.</p><p>It expires in 5 minutes. Do not share this code.</p>`,
        }),
      });
      if (!mailResponse.ok) {
        console.error("Resend failed with status:", mailResponse.status);
        await supabase.from("otps").update({ used: true }).eq("job_id", jobId).ilike("email_address", email).eq("used", false);
        return json({ error: "Could not send verification email. Please try again later." }, 502);
      }
      return json({ success: true, message: "OTP sent", expires_in_seconds: 300 });
    }

    if (action === "verify") {
      const code = typeof body.otp === "string" ? body.otp.trim() : "";
      if (!/^\d{6}$/.test(code)) return json({ error: "Enter the 6-digit verification code" }, 400);
      const { data: record, error } = await supabase.from("otps")
        .select("id, otp_hash, used, expires_at, attempts, max_attempts, locked_until")
        .eq("job_id", jobId).ilike("email_address", email).eq("used", false)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error || !record) return json({ error: "OTP not found. Request a new code." }, 404);
      if (record.locked_until && new Date(record.locked_until).getTime() > Date.now()) {
        return json({ error: "Verification is temporarily locked. Try again later." }, 429);
      }
      if (new Date(record.expires_at).getTime() < Date.now()) return json({ error: "OTP expired. Request a new code." }, 410);
      if (record.attempts >= record.max_attempts) return json({ error: "Too many incorrect attempts. Request a new code later." }, 429);

      const candidate = await hashOtp(jobId, email, code, serviceKey);
      if (!record.otp_hash || !constantTimeEqual(record.otp_hash, candidate)) {
        const nextAttempts = Number(record.attempts) + 1;
        await supabase.from("otps").update({
          attempts: nextAttempts,
          locked_until: nextAttempts >= Number(record.max_attempts)
            ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
        }).eq("id", record.id);
        return json({ error: "Incorrect verification code" }, 400);
      }
      const { data: order, error: orderLookupError } = await supabase.from("print_orders")
        .select("id, order_number, payment_method, payment_status, order_status, customer_email")
        .eq("print_job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (orderLookupError) {
        console.error("OTP verification order lookup failed:", orderLookupError.message);
        return json({ error: "Could not validate the print order" }, 500);
      }
      if (!order || order.order_status === "cancelled" || order.order_status === "failed") {
        return json({ error: "A valid print order is required" }, 404);
      }
      if (!order.customer_email || order.customer_email.trim().toLowerCase() !== email) {
        return json({ error: "This email does not match the print order" }, 403);
      }
      if (order.payment_method === "razorpay" && order.payment_status !== "paid") {
        return json({ error: "Online payment has not been verified" }, 409);
      }
      if (order.payment_method === "cod" && !["pending", "paid"].includes(order.payment_status)) {
        return json({ error: "This Cash on Delivery order cannot be released" }, 409);
      }

      const { data: job, error: jobLookupError } = await supabase.from("print_jobs")
        .select("id, status, expiry_time").eq("id", jobId).maybeSingle();
      if (jobLookupError || !job) return json({ error: "Print job not found" }, 404);
      if (job.status === "expired" || job.status === "failed" || new Date(job.expiry_time).getTime() < Date.now()) {
        return json({ error: "Print job has expired" }, 410);
      }

      // Consume the valid OTP, then make the job visible to the always-on print agent.
      const { data: consumed, error: markUsedError } = await supabase.from("otps")
        .update({ used: true }).eq("id", record.id).eq("used", false).select("id").maybeSingle();
      if (markUsedError || !consumed) {
        return json({ error: "This OTP has already been used. Request a new code if needed." }, 409);
      }

      let queuedStatus = job.status;
      if (job.status === "pending") {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { data: queued, error: queueError } = await supabase.from("print_jobs")
          .update({ status: "ready", expiry_time: expiresAt, locked: false })
          .eq("id", jobId).eq("status", "pending").select("id, status, expiry_time").maybeSingle();
        if (queueError || !queued) {
          await supabase.from("otps").update({ used: false }).eq("id", record.id);
          console.error("OTP verified but job could not be queued:", queueError?.message ?? "job state changed");
          return json({ error: "OTP verified, but the print job could not be queued. Please try again." }, 409);
        }
        queuedStatus = queued.status;
      } else if (!["ready", "printing", "completed"].includes(job.status)) {
        await supabase.from("otps").update({ used: false }).eq("id", record.id);
        return json({ error: "Print job cannot be queued in its current state" }, 409);
      }

      if (job.status === "pending") {
        await supabase.from("print_orders").update({ order_status: "accepted" })
          .eq("print_job_id", jobId).eq("order_status", "pending");
      }

      await supabase.from("logs").insert({
        type: "success",
        message: "Email OTP verified; print job released to queue",
        job_id: jobId,
        metadata: { order_number: order.order_number ?? null, job_status: queuedStatus },
      });
      return json({ success: true, verified: true, job_status: queuedStatus });
    }

    return json({ error: "Action must be send or verify" }, 400);
  } catch (e) {
    console.error("secure-otp failed:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Invalid request or internal server error" }, 500);
  }
});