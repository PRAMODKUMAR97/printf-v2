import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const EXTENSIONS = new Set(["pdf", "doc", "docx", "png", "jpg", "jpeg"]);
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const fileName = typeof body.file_name === "string" ? body.file_name.slice(0, 255) : "";
    const jobId = typeof body.file_id === "string" ? body.file_id : crypto.randomUUID();
    const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId) ||
        !fileName.trim() || !EXTENSIONS.has(extension)) {
      return json({ error: "Provide a valid file_name and supported extension (PDF, DOC, DOCX, PNG, JPG)" }, 400);
    }
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Server configuration error" }, 500);
    const supabase = createClient(url, key);
    const path = `jobs/${jobId}.${extension}`;
    const { data, error } = await supabase.storage.from("print-files").createSignedUploadUrl(path, { upsert: false });
    if (error || !data) {
      console.error("secure-upload URL creation failed:", error?.message ?? "no data");
      return json({ error: "Could not create a secure upload URL" }, 500);
    }
    return json({
      success: true,
      bucket: "print-files",
      path,
      token: data.token,
      signed_url: data.signedUrl,
      expires_in_seconds: 120,
      max_file_size_bytes: 52428800,
    });
  } catch (e) {
    console.error("secure-upload failed:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Invalid request or internal server error" }, 500);
  }
});