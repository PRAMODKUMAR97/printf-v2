import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OTP_EXPIRY_MS = 24 * 60 * 60 * 1000;

function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function createOtp() { const value = new Uint32Array(1); crypto.getRandomValues(value); return String(value[0] % 10000).padStart(4, "0"); }
async function hashOtp(orderId: string, otp: string, pepper: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${pepper}:${orderId}:${otp}`));
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}
async function requireAdmin(request: Request, supabase: any) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return false;
  const { data: userResult, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userResult.user) return false;
  const { data: role, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", userResult.user.id).eq("role", "admin").maybeSingle();
  return !roleError && Boolean(role);
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);
  try {
    const body = await request.json();
    const action = body?.action;
    const orderId = body?.order_id;
    if ((action !== "prepare" && action !== "verify") || typeof orderId !== "string" || !UUID_RE.test(orderId)) return response({ error: "Valid action and order_id are required" }, 400);
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const pepper = Deno.env.get("DELIVERY_OTP_PEPPER");
    if (!url || !serviceKey || !pepper) return response({ error: "Server configuration error" }, 500);
    const supabase = createClient(url, serviceKey);
    if (!await requireAdmin(request, supabase)) return response({ error: "Administrator access is required" }, 403);

    if (action === "verify") {
      const otp = typeof body?.otp === "string" ? body.otp.trim() : "";
      if (!/^\d{4}$/.test(otp)) return response({ error: "Enter the customer's four-digit delivery OTP" }, 400);
      const { data: order, error } = await supabase.from("print_orders").select("id, order_number, order_status, delivery_otp_hash, delivery_otp_expires_at, delivery_otp_attempts").eq("id", orderId).maybeSingle();
      if (error || !order) return response({ error: "Order not found" }, 404);
      if (order.order_status === "completed" || !order.delivery_otp_hash || !order.delivery_otp_expires_at || new Date(order.delivery_otp_expires_at).getTime() <= Date.now()) return response({ error: "This delivery OTP is expired or already used" }, 400);
      if (Number(order.delivery_otp_attempts ?? 0) >= 5) return response({ error: "Too many incorrect attempts. Generate a fresh delivery OTP." }, 429);
      const candidateHash = await hashOtp(order.id, otp, pepper);
      if (!constantTimeEqual(order.delivery_otp_hash, candidateHash)) {
        await supabase.from("print_orders").update({ delivery_otp_attempts: Number(order.delivery_otp_attempts ?? 0) + 1 }).eq("id", order.id);
        return response({ error: "The delivery OTP is incorrect" }, 400);
      }
      const { data: delivered, error: completeError } = await supabase.from("print_orders").update({ order_status: "completed", delivery_otp: null, delivery_otp_hash: null, delivery_otp_attempts: 0 }).eq("id", order.id).eq("delivery_otp_hash", candidateHash).select("id").maybeSingle();
      if (completeError || !delivered) return response({ error: "The OTP was already used or has expired" }, 409);
      await supabase.from("logs").insert({ type: "success", message: "Delivery OTP verified", metadata: { order_number: order.order_number } });
      return response({ success: true, message: "Delivery verified", order_number: order.order_number });
    }

    const { data: order, error } = await supabase.from("print_orders").select("id, order_number, payment_method, payment_status, order_status, delivery_otp, delivery_otp_hash, delivery_otp_expires_at").eq("id", orderId).maybeSingle();
    if (error || !order) return response({ error: "Order not found" }, 404);
    if (["completed", "cancelled", "failed"].includes(order.order_status)) return response({ error: "This order cannot receive a delivery OTP" }, 409);
    if (order.payment_method !== "cod" && order.payment_status !== "paid") return response({ error: "Complete payment before preparing delivery details" }, 409);
    const hasActiveOtp = order.delivery_otp && order.delivery_otp_hash && order.delivery_otp_expires_at && new Date(order.delivery_otp_expires_at).getTime() > Date.now();
    if (hasActiveOtp) return response({ success: true, delivery_otp: order.delivery_otp, expires_at: order.delivery_otp_expires_at });

    const otp = createOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
    const { error: saveError } = await supabase.from("print_orders").update({ delivery_otp: otp, delivery_otp_hash: await hashOtp(order.id, otp, pepper), delivery_otp_expires_at: expiresAt, delivery_otp_sent_at: null, delivery_otp_attempts: 0 }).eq("id", order.id);
    if (saveError) return response({ error: "Could not prepare the delivery OTP" }, 500);
    await supabase.from("logs").insert({ type: "info", message: "Delivery OTP prepared for WhatsApp handoff", metadata: { order_number: order.order_number } });
    return response({ success: true, delivery_otp: otp, expires_at: expiresAt });
  } catch (error) {
    console.error("delivery-otp failed:", error instanceof Error ? error.message : "unknown");
    return response({ error: "Invalid request or internal server error" }, 500);
  }
});
