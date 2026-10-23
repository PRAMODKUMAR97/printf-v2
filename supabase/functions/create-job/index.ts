import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

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
        typeof file_size !== "number" || !Number.isInteger(file_size) ||
        file_size <= 0 || file_size > MAX_FILE_SIZE) {
      return response({ error: "Valid file_path, file_name and file_size (up to 50MB) are required" }, 400);
    }
    const allowedExtensions = ["pdf", "doc", "docx", "png", "jpg", "jpeg"];
    const pathMatch = file_path.match(/^jobs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(pdf|doc|docx|png|jpg|jpeg)$/i);
    const fileExtension = file_name.trim().split(".").pop()?.toLowerCase() ?? "";
    if (!pathMatch || file_path.length > 500 || !allowedExtensions.includes(fileExtension) ||
        pathMatch[2].toLowerCase() !== fileExtension || !file_name.trim() ||
        file_name.length > 255 || /[\u0000-\u001f\u007f]/.test(file_name)) {
      return response({ error: "Use a valid UUID file path and a supported file name (PDF, DOC, DOCX, PNG, JPG)" }, 400);
    }
    if (printf_id && (typeof printf_id !== "string" || !UUID_RE.test(printf_id))) return response({ error: "Invalid printer station ID" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return response({ error: "Server configuration error" }, 500);
    const supabase = createClient(supabaseUrl, serviceKey);

    if (printf_id) {
      const { data: station, error } = await supabase.from("printfs").select("id, status").eq("id", printf_id).maybeSingle();
      if (error || !station) return response({ error: "PrintF station not found" }, 404);
      if (station.status !== "online") return response({ error: "PrintF station is not available" }, 400);
    }

    const expectedObjectName = file_path.slice("jobs/".length);
    const { data: storedObjects, error: objectLookupError } = await supabase.storage.from("print-files")
      .list("jobs", { search: expectedObjectName, limit: 100, offset: 0 });
    if (objectLookupError) {
      console.error("Uploaded file metadata lookup failed:", objectLookupError.message);
      return response({ error: "Could not validate the uploaded file. Please retry." }, 500);
    }
    const storedObject = storedObjects?.find((item) => item.name === expectedObjectName);
    const actualFileSize = Number(storedObject?.metadata?.size);
    if (!storedObject || !Number.isInteger(actualFileSize) || actualFileSize <= 0 || actualFileSize > MAX_FILE_SIZE) {
      return response({ error: "Uploaded file was not found or is larger than 50 MB. Please upload it again." }, 400);
    }
    if (file_size !== actualFileSize) {
      return response({ error: "The uploaded file size changed. Please upload the file again." }, 400);
    }

    const input = settings_json && typeof settings_json === "object" && !Array.isArray(settings_json) ? settings_json : {};
    const numberValue = (key: string, fallback: number) => {
      const n = Number(input[key] ?? fallback);
      return Number.isFinite(n) ? n : NaN;
    };
    const copies = numberValue("copies", 1);
    const layout = numberValue("layout", 1);
    const requestedPageCount = numberValue("page_count", 1);
    const pageRange = typeof input.page_range === "string" ? input.page_range.trim().slice(0, 200) : "";
    if (!Number.isInteger(copies) || copies < 1 || copies > 50 ||
        ![1, 2, 4].includes(layout) ||
        !Number.isInteger(requestedPageCount) || requestedPageCount < 1 || requestedPageCount > 10000) {
      return response({ error: "Invalid print settings or page count" }, 400);
    }

    // Images are one page; Word documents use the same conservative estimate as the
    // browser. PDFs are parsed server-side so clients cannot understate billable pages.
    let pageCount = ["png", "jpg", "jpeg"].includes(fileExtension)
      ? 1
      : ["doc", "docx"].includes(fileExtension)
        ? Math.max(1, Math.ceil(actualFileSize / 50000))
        : requestedPageCount;
    if (fileExtension === "pdf") {
      const { data: pdfBlob, error: pdfDownloadError } = await supabase.storage.from("print-files").download(file_path);
      if (pdfDownloadError || !pdfBlob) {
        console.error("Uploaded PDF download failed:", pdfDownloadError?.message ?? "no data");
        return response({ error: "Could not read the uploaded PDF. Please upload it again." }, 400);
      }
      try {
        const document = await PDFDocument.load(await pdfBlob.arrayBuffer());
        pageCount = document.getPageCount();
        if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 10000) {
          return response({ error: "This PDF has an unsupported page count (maximum 10,000 pages)." }, 400);
        }
      } catch (pdfError) {
        console.warn("PDF page-count parsing failed:", pdfError instanceof Error ? pdfError.message : "unknown");
        return response({ error: "This PDF could not be read. Please re-save it as a standard, unprotected PDF and upload it again." }, 400);
      }
    }

    // Recalculate the billable page count and sheets on the server; never trust totals sent by the browser.
    const selectedPageSet = new Set<number>();
    if (pageRange) {
      for (const part of pageRange.split(",")) {
        const match = part.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
        if (!match) continue;
        const start = Number(match[1]);
        const end = Number(match[2] ?? match[1]);
        for (let page = Math.min(start, end); page <= Math.max(start, end) && page <= pageCount; page++) {
          if (page >= 1) selectedPageSet.add(page);
        }
      }
    }
    const selectedPages = selectedPageSet.size || pageCount;
    const sheets = Math.ceil(selectedPages / layout);
    const pageSize = "A4";
    const normalizedSettings = {
      copies, color: input.color === true, duplex: input.duplex === true, page_size: pageSize,
      borderless: input.borderless === true, layout, page_range: pageRange,
      fit_to_page: input.fit_to_page !== false, page_count: pageCount,
      selected_pages: selectedPages, sheets,
    };

    const { data: job, error: insertError } = await supabase.from("print_jobs").insert({
      file_path, file_name: file_name.trim(), file_size: actualFileSize, printf_id: printf_id || null,
      settings_json: normalizedSettings, status: "pending", locked: false,
    }).select().single();
    if (insertError || !job) {
      console.error("create-job insert failed:", insertError?.message ?? "no row returned");
      return response({ error: "Failed to create print job" }, 500);
    }
    await supabase.from("logs").insert({
      type: "info", message: "Print job created", job_id: job.id, printf_id: printf_id || null,
      metadata: { file_name: file_name.trim(), file_size: actualFileSize, page_count: pageCount, selected_pages: selectedPages, sheets },
    });
    return response({ success: true, job });
  } catch (error) {
    console.error("create-job failed:", error instanceof Error ? error.message : "unknown");
    return response({ error: "Invalid request or internal server error" }, 500);
  }
});