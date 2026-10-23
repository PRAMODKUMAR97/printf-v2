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
function validCustomer(name: unknown, mobile: unknown) {
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) return false;
  if (typeof mobile !== "string" || !/^[0-9+() -]{8,20}$/.test(mobile.trim())) return false;
  const digits = mobile.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}
function calculateAmount(settingsValue: unknown) {
  const settings = settingsValue && typeof settingsValue === "object" ? settingsValue as Record<string, unknown> : {};
  const copies = Number(settings.copies ?? 1);
  const layout = Number(settings.layout ?? 1);
  const selectedPages = Number(settings.selected_pages ?? settings.page_count ?? 1);
  const sheets = Number(settings.sheets ?? Math.ceil(selectedPages / Math.max(1, layout)));
  if (!Number.isInteger(copies) || copies < 1 || copies > 50 ||
      ![1, 2, 4].includes(layout) ||
      !Number.isInteger(selectedPages) || selectedPages < 1 || selectedPages > 10000 ||
      !Number.isInteger(sheets) || sheets < 1 || sheets > 10000) return null;
  return Math.round(sheets * copies * (settings.color === true ? 10 : 2) * 100) / 100;
}
function checkoutResponse(order: any, payment: any, keyId: string, callbackUrl?: string) {
  return {
    success: true,
    print_order_id: order.id,
    order_number: order.order_number,
    order_id: order.razorpay_order_id,
    amount: Math.round(Number(payment.amount) * 100),
    currency: "INR",
    key_id: keyId,
    callback_url: callbackUrl,
    checkout_options: {
      key: keyId,
      amount: Math.round(Number(payment.amount) * 100),
      currency: "INR",
      name: "PrintF",
      description: "Print Job #" + order.order_number,
      order_id: order.razorpay_order_id,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const { job_id, amount, customer_name, customer_mobile, customer_email, payment_method, callback_url } = body ?? {};
    const method = payment_method ?? "razorpay";
    if (typeof job_id !== "string" || !UUID_RE.test(job_id)) return response({ error: "Valid job_id is required" }, 400);
    if (!validCustomer(customer_name, customer_mobile)) return response({ error: "A valid customer name and mobile number are required" }, 400);
    if (typeof customer_email !== "string" || customer_email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email.trim())) return response({ error: "A valid customer email is required for print OTP verification" }, 400);
    if (!["razorpay", "cod"].includes(method)) return response({ error: "Unsupported payment method" }, 400);
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 1 || amount > 100000) {
      return response({ error: "Valid payment amount is required" }, 400);
    }
    if (callback_url && (typeof callback_url !== "string" || !/^https?:\/\//i.test(callback_url))) {
      return response({ error: "Invalid callback_url" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return response({ error: "Server configuration error" }, 500);
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: existing, error: existingError } = await supabase.from("print_orders")
      .select("*").eq("print_job_id", job_id)
      .not("order_status", "in", '("cancelled","failed")')
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existingError) {
      console.error("Existing print order lookup failed:", existingError.message);
      return response({ error: "Unable to check existing order" }, 500);
    }
    if (existing && existing.order_status !== "cancelled") {
      const sameCustomer = existing.customer_name === customer_name.trim() &&
        existing.customer_mobile === customer_mobile.trim() &&
        (!existing.customer_email || existing.customer_email.trim().toLowerCase() === customer_email.trim().toLowerCase());
      if (!sameCustomer) return response({ error: "An order already exists for this print job with different customer details. Start a new print job or contact support." }, 409);
      if (!existing.customer_email) {
        const { error: emailUpdateError } = await supabase.from("print_orders")
          .update({ customer_email: customer_email.trim().toLowerCase() }).eq("id", existing.id);
        if (emailUpdateError) return response({ error: "Could not update the existing order contact" }, 500);
      }
      if (existing.payment_status === "paid" || existing.cod_collected === true) {
        return response({ success: true, already_paid: true, print_order_id: existing.id,
          order_number: existing.order_number, payment_method: existing.payment_method });
      }
      if (existing.payment_method !== method) {
        return response({ error: "An order already exists for this print job with a different payment method. Please use that order or start a new print job." }, 409);
      }
      if (method === "cod") {
        return response({ success: true, print_order_id: existing.id, order_number: existing.order_number,
          payment_method: "cod", amount: Number(existing.amount) });
      }
      const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
      if (!razorpayKeyId || !existing.razorpay_order_id) return response({ error: "Payment service is not configured" }, 503);
      const { data: priorPayment, error: priorPaymentError } = await supabase.from("payments")
        .select("amount").eq("gateway_ref", existing.razorpay_order_id).eq("job_id", job_id).maybeSingle();
      if (priorPaymentError || !priorPayment) return response({ error: "Existing payment order could not be resumed" }, 409);
      const origin = req.headers.get("origin");
      return response(checkoutResponse(existing, priorPayment, razorpayKeyId,
        callback_url || (origin ? origin + "/payment-callback" : undefined)));
    }

    const { data: job, error: jobError } = await supabase.from("print_jobs")
      .select("id, status, locked, settings_json").eq("id", job_id).maybeSingle();
    if (jobError) {
      console.error("Print job lookup failed:", jobError.message);
      return response({ error: "Unable to validate print job" }, 500);
    }
    if (!job) return response({ error: "Print job not found" }, 404);
    if (job.status !== "pending" || job.locked) return response({ error: "Print job is not eligible for checkout" }, 409);

    const expectedAmount = calculateAmount(job.settings_json);
    if (expectedAmount === null || Math.round(amount * 100) !== Math.round(expectedAmount * 100)) {
      return response({ error: "Payment amount does not match the recorded print settings. Return to the settings screen and try again." }, 400);
    }

    if (method === "cod") {
      const { data: order, error: orderError } = await supabase.from("print_orders").insert({
        customer_name: customer_name.trim(),
        customer_mobile: customer_mobile.trim(),
        customer_email: customer_email.trim().toLowerCase(),
        print_job_id: job_id,
        amount: expectedAmount,
        payment_method: "cod",
        payment_status: "pending",
        order_status: "pending",
        cod_collected: false,
      }).select("id, order_number, amount, payment_method, payment_status, order_status, cod_collected").single();
      if (orderError || !order) {
        console.error("COD order insert failed:", orderError?.message ?? "no row returned");
        return response({ error: "Could not create Cash on Delivery order" }, 500);
      }
      // Keep the job pending until the emailed OTP is verified. Extend its
      // reservation window so a temporary email/printer delay does not expire it.
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: reservedJob, error: reserveError } = await supabase.from("print_jobs")
        .update({ expiry_time: expiresAt, locked: false })
        .eq("id", job_id).eq("status", "pending").select("id").maybeSingle();
      if (reserveError || !reservedJob) {
        await supabase.from("print_orders").update({ order_status: "cancelled" }).eq("id", order.id);
        console.error("COD job reservation failed:", reserveError?.message ?? "job state changed concurrently");
        return response({ error: "The print job could not be reserved. Please contact support." }, 409);
      }
      await supabase.from("logs").insert({ type: "info", message: "Cash on Delivery order created", job_id,
        metadata: { order_number: order.order_number, amount: expectedAmount } });
      return response({ success: true, print_order_id: order.id, order_number: order.order_number,
        payment_method: "cod", amount: expectedAmount, already_paid: false });
    }

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeyId || !razorpayKeySecret) return response({ error: "Payment service is not configured" }, 503);
    const authHeader = "Basic " + btoa(razorpayKeyId + ":" + razorpayKeySecret);
    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authHeader },
      body: JSON.stringify({ amount: Math.round(expectedAmount * 100), currency: "INR",
        receipt: "job_" + job_id.slice(0, 8), notes: { job_id, payment_method: "razorpay" } }),
    });
    const orderText = await orderResponse.text();
    if (!orderResponse.ok) {
      console.error("Razorpay order creation failed with status:", orderResponse.status);
      return response({ error: "Failed to create payment order" }, 502);
    }
    let razorpayOrder: { id: string; amount: number; currency: string };
    try { razorpayOrder = JSON.parse(orderText); } catch { return response({ error: "Invalid response from payment service" }, 502); }
    if (!razorpayOrder.id || !Number.isFinite(razorpayOrder.amount)) return response({ error: "Invalid response from payment service" }, 502);

    const { data: printOrder, error: printOrderError } = await supabase.from("print_orders").insert({
      customer_name: customer_name.trim(),
      customer_mobile: customer_mobile.trim(),
      customer_email: customer_email.trim().toLowerCase(),
      print_job_id: job_id,
      amount: expectedAmount,
      payment_method: "razorpay",
      payment_status: "pending",
      order_status: "pending",
      cod_collected: false,
      razorpay_order_id: razorpayOrder.id,
    }).select("id, order_number, amount, payment_method, payment_status, order_status, cod_collected, razorpay_order_id").single();
    if (printOrderError || !printOrder) {
      console.error("Print order insert failed:", printOrderError?.message ?? "no row returned");
      return response({ error: "Could not save the order record" }, 500);
    }
    const { data: payment, error: paymentError } = await supabase.from("payments").insert({
      job_id, amount: expectedAmount, status: "pending", gateway_ref: razorpayOrder.id,
    }).select("amount").single();
    if (paymentError || !payment) {
      await supabase.from("print_orders").update({ payment_status: "failed", order_status: "cancelled" }).eq("id", printOrder.id);
      console.error("Payment record insert failed:", paymentError?.message ?? "no row returned");
      return response({ error: "Could not save the payment record" }, 500);
    }
    await supabase.from("logs").insert({ type: "info", message: "Razorpay order created", job_id,
      metadata: { order_number: printOrder.order_number, gateway_ref: razorpayOrder.id, amount: expectedAmount } });
    const origin = req.headers.get("origin");
    return response(checkoutResponse(printOrder, payment, razorpayKeyId,
      callback_url || (origin ? origin + "/payment-callback" : undefined)));
  } catch (error) {
    console.error("create-order failed:", error instanceof Error ? error.message : "unknown");
    return response({ error: "Invalid request or internal server error" }, 500);
  }
});
