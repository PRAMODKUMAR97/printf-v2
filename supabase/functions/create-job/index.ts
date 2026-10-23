import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const { file_path, file_name, file_size, printf_id, settings_json } = body ?? {};
    if (typeof file_path !== "string" || typeof file_name !== "string" ||
        typeof file_size !== "number" || !Number.isFinite(file_size) ||
        file_size <= 0 || file_size > MAX_FILE_SIZE) {
      return response({ error: "Valid file_path, file_name and file_size (up to 50MB) are required" }, 400);
    }
    if (!file_path.startsWith("jobs/") || file_path.includes("..") || file_path.includes("\\") || file_path.length > 500) {
      return response({ error: "Invalid file path" }, 400);
    }
    if (!file_name.trim() || file_name.length > 255) return response({ error: "Invalid file name" }, 400);
    if (printf_id && (typeof printf_id !== "string" || !UUID_RE.test(printf_id))) return response({ error: "Invalid printer station ID" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return response({ error: "Server configuration error" }, 500);
    const supabase = createClient(supabaseUrl, serviceKey);

    if (printf_id) {
      const { data: station, error } = await supabase.from("printfs")
        .select("id, name, status").eq("id", printf_id).maybeSingle();
      if (error || !station) return response({ error: "PrintF station not found" }, 404);
      const acceptsManualOrders = station.name.trim().toLowerCase() === "canara engineering college";
      if (station.status !== "online" && !acceptsManualOrders) {
        return response({ error: "PrintF station is not available" }, 400);
      }
    }

    const { data: signedFile, error: storageError } = await supabase.storage.from("print-files").createSignedUrl(file_path, 30);
    if (storageError || !signedFile?.signedUrl) {
      console.warn("Uploaded print file could not be confirmed:", storageError?.message ?? "not found");
      return response({ error: "Uploaded print file was not found. Upload it before creating a job." }, 400);
    }

    const input = settings_json && typeof settings_json === "object" && !Array.isArray(settings_json) ? settings_json : {};
    const numberValue = (key: string, fallback: number) => {
      const n = Number(input[key] ?? fallback);
      return Number.isFinite(n) ? n : NaN;
    };
    const copies = numberValue("copies", 1);
    const layout = numberValue("layout", 1);
    const pageCount = numberValue("page_count", 1);
    const selectedPages = numberValue("selected_pages", pageCount);
    const sheets = numberValue("sheets", Math.ceil(selectedPages / Math.max(1, layout)));
    if (!Number.isInteger(copies) || copies < 1 || copies > 100 ||
        !Number.isInteger(layout) || layout < 1 || layout > 16 ||
        !Number.isInteger(pageCount) || pageCount < 1 || pageCount > 10000 ||
        !Number.isInteger(selectedPages) || selectedPages < 1 || selectedPages > pageCount ||
        !Number.isInteger(sheets) || sheets < 1 || sheets > 10000) {
      return response({ error: "Invalid print settings or page count" }, 400);
    }
    const pageRange = typeof input.page_range === "string" ? input.page_range.slice(0, 200) : "";
    const pageSize = ["A4", "A3", "Letter", "Legal"].includes(input.page_size) ? input.page_size : "A4";
    const normalizedSettings = {
      copies, color: input.color === true, duplex: input.duplex === true, page_size: pageSize,
      borderless: input.borderless === true, layout, page_range: pageRange,
      fit_to_page: input.fit_to_page !== false, page_count: pageCount,
      selected_pages: selectedPages, sheets,
    };

    const { data: job, error: insertError } = await supabase.from("print_jobs").insert({
      file_path, file_name: file_name.trim(), file_size, printf_id: printf_id || null,
      settings_json: normalizedSettings, status: "pending", locked: false,
    }).select().single();
    if (insertError || !job) {
      console.error("create-job insert failed:", insertError?.message ?? "no row returned");
      return response({ error: "Failed to create print job" }, 500);
    }
    await supabase.from("logs").insert({
      type: "info", message: "Print job created", job_id: job.id, printf_id: printf_id || null,
      metadata: { file_name: file_name.trim(), file_size, page_count: pageCount, selected_pages: selectedPages, sheets },
    });
    return response({ success: true, job });
  } catch (error) {
    console.error("create-job failed:", error instanceof Error ? error.message : "unknown");
    return response({ error: "Invalid request or internal server error" }, 500);
  }
});
