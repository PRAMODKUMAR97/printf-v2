import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function hex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, job_id } = body ?? {};
    if (typeof razorpay_payment_id !== "string" || typeof razorpay_order_id !== "string" ||
        typeof razorpay_signature !== "string" || typeof job_id !== "string" ||
        !UUID_RE.test(job_id) || razorpay_payment_id.length > 100 ||
        razorpay_order_id.length > 100 || !/^[0-9a-f]{64}$/i.test(razorpay_signature)) {
      return response({ error: "Valid payment details and job_id are required" }, 400);
    }

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!razorpayKeyId || !razorpayKeySecret) return response({ error: "Payment service is not configured" }, 503);
    if (!supabaseUrl || !serviceKey) return response({ error: "Server configuration error" }, 500);

    const signingKey = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(razorpayKeySecret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const signed = await crypto.subtle.sign(
      "HMAC", signingKey, new TextEncoder().encode(razorpay_order_id + "|" + razorpay_payment_id),
    );
    if (!constantTimeEqual(hex(new Uint8Array(signed)), razorpay_signature.toLowerCase())) {
      return response({ error: "Payment signature verification failed" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: payment, error: paymentLookupError } = await supabase.from("payments")
      .select("id, job_id, amount, status, gateway_ref")
      .eq("gateway_ref", razorpay_order_id).eq("job_id", job_id).maybeSingle();
    if (paymentLookupError) {
      console.error("payment record lookup failed:", paymentLookupError.message);
      return response({ error: "Unable to validate payment record" }, 500);
    }
    if (!payment) return response({ error: "Payment order does not match this print job" }, 404);

    // Confirm the payment against Razorpay's API, including captured state and amount.
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    if (!paymentResponse.ok) {
      console.error("Razorpay payment lookup returned status:", paymentResponse.status);
      return response({ error: "Unable to confirm payment with Razorpay" }, 502);
    }
    const razorpayPayment = await paymentResponse.json();
    if (razorpayPayment.order_id !== razorpay_order_id ||
        razorpayPayment.currency !== "INR" ||
        Number(razorpayPayment.amount) !== Math.round(Number(payment.amount) * 100)) {
      return response({ error: "Payment details do not match the recorded order" }, 400);
    }
    if (razorpayPayment.status !== "captured" || razorpayPayment.captured !== true) {
      return response({ error: "Payment has not been captured yet" }, 409);
    }

    const { data: job, error: jobLookupError } = await supabase.from("print_jobs")
      .select("id, status, expiry_time, locked")
      .eq("id", job_id).maybeSingle();
    if (jobLookupError || !job) return response({ error: "Print job not found" }, 404);

    const { error: markPaymentError } = await supabase.from("payments")
      .update({ status: "completed" }).eq("id", payment.id);
    if (markPaymentError) {
      console.error("Could not mark payment completed:", markPaymentError.message);
      return response({ error: "Could not record verified payment" }, 500);
    }
    // Keep the order ledger accurate even if the physical job needs manual review.
    const { error: markOrderError } = await supabase.from("print_orders").update({
      payment_status: "paid",
      razorpay_order_id,
      razorpay_payment_id,
    }).eq("print_job_id", job_id).eq("payment_method", "razorpay");
    if (markOrderError) {
      console.error("Could not update PrintF order:", markOrderError.message);
      return response({ error: "Payment verified, but order status needs administrator review" }, 500);
    }

    let jobStatus = job.status;
    let finalExpiry = job.expiry_time;
    if (job.status === "pending") {
      // Payment success must NOT make the job printable. OTP verification does that.
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: extended, error: extendError } = await supabase.from("print_jobs")
        .update({ expiry_time: expiresAt, locked: false })
        .eq("id", job_id).eq("status", "pending").select("id, status, expiry_time").maybeSingle();
      if (extendError || !extended) {
        console.error("Could not extend verified job expiry:", extendError?.message ?? "job state changed concurrently");
        return response({ error: "Payment was verified, but the job needs administrator review" }, 409);
      }
      jobStatus = extended.status;
      finalExpiry = extended.expiry_time;
    } else if (!["ready", "printing", "completed"].includes(job.status)) {
      await supabase.from("logs").insert({
        type: "warning", message: "Payment captured but print job requires manual review",
        job_id, metadata: { razorpay_payment_id, razorpay_order_id, job_status: job.status },
      });
      return response({ error: "Payment was captured, but the job is no longer printable. Contact support." }, 409);
    }

    await supabase.from("logs").insert({
      type: "success",
      message: "Payment verified with Razorpay",
      job_id,
      metadata: { razorpay_payment_id, razorpay_order_id, job_status: jobStatus, expiry_time: finalExpiry },
    });

    return response({
      success: true, message: "Payment verified successfully",
      job_status: jobStatus, expiry_time: finalExpiry,
    });
  } catch (error) {
    console.error("verify-payment failed:", error instanceof Error ? error.message : "unknown");
    return response({ error: "Invalid request or internal server error" }, 500);
  }
});