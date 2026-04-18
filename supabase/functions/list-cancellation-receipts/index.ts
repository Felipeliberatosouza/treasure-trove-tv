import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReceiptItem {
  path: string;
  fileName: string;
  userId: string;
  studentName: string | null;
  studentEmail: string | null;
  createdAt: string | null;
  size: number | null;
  signedUrl: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabaseAuth.auth.getUser(token);
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List user folders (top-level)
    const { data: folders, error: foldersErr } = await supabase.storage
      .from("cancellation-receipts").list("", { limit: 1000, sortBy: { column: "name", order: "asc" } });
    if (foldersErr) throw foldersErr;

    const items: ReceiptItem[] = [];
    const userIds = new Set<string>();

    for (const folder of folders ?? []) {
      // Folders appear with id === null typically
      if (!folder?.name) continue;
      const userId = folder.name;
      userIds.add(userId);

      const { data: files } = await supabase.storage
        .from("cancellation-receipts").list(userId, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });

      for (const f of files ?? []) {
        if (!f?.name || !f.name.endsWith(".pdf")) continue;
        const path = `${userId}/${f.name}`;
        const { data: signed } = await supabase.storage
          .from("cancellation-receipts").createSignedUrl(path, 60 * 60 * 24 * 7);
        items.push({
          path,
          fileName: f.name,
          userId,
          studentName: null,
          studentEmail: null,
          createdAt: f.created_at ?? null,
          size: (f.metadata as any)?.size ?? null,
          signedUrl: signed?.signedUrl ?? "",
        });
      }
    }

    // Enrich with profile info
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, name, email")
        .in("user_id", Array.from(userIds));
      const map = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      for (const it of items) {
        const p = map.get(it.userId);
        if (p) { it.studentName = p.name; it.studentEmail = p.email; }
      }
    }

    // Sort by createdAt desc
    items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return new Response(JSON.stringify({ items }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[list-cancellation-receipts] ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
