// Renderização neural (frame a frame) do avatar para AULAS ESPECIAIS.
// Usa o retrato do professor + o áudio ElevenLabs já salvo de cada slide e envia
// ao provedor de vídeo neural (D-ID). O MP4 gerado fica salvo e o player o usa
// no lugar do avatar ilustrado. Ações:
//  - start (admin): cria as renderizações de todos os slides
//  - poll  (admin): consulta as pendentes e salva os vídeos prontos
//  - get   (público): devolve os vídeos prontos de uma aula
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUCKET = "ai-revision-media";
const TYPE = "neural_video";
const Body = z.object({
  action: z.enum(["start", "poll", "get"]),
  canonical_id: z.string().uuid(),
  portrait_url: z.string().url().max(1000).optional(),
});

const didHeaders = () => {
  const key = Deno.env.get("DID_API_KEY");
  if (!key) throw new Error("Chave do provedor de vídeo neural não configurada.");
  return { Authorization: `Basic ${key}`, "Content-Type": "application/json", accept: "application/json" };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Dados inválidos." }, 400);
    const { action, canonical_id, portrait_url } = parsed.data;

    if (action === "get") {
      const { data } = await admin.from("ai_content_artifacts")
        .select("slide_index, storage_path").eq("canonical_id", canonical_id)
        .eq("artifact_type", TYPE).eq("status", "ready");
      const videos: Record<number, string> = {};
      for (const row of data ?? []) {
        if (!row.storage_path) continue;
        const { data: s } = await admin.storage.from(BUCKET).createSignedUrl(row.storage_path, 3600 * 6);
        if (s?.signedUrl) videos[row.slide_index] = s.signedUrl;
      }
      return json({ videos });
    }

    // Ações administrativas.
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado." }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Apenas administradores." }, 403);

    if (action === "start") {
      if (!portrait_url) return json({ error: "Envie o retrato do professor." }, 400);
      const { data: audios } = await admin.from("ai_content_artifacts")
        .select("slide_index, storage_path").eq("canonical_id", canonical_id)
        .eq("artifact_type", "audio").eq("status", "ready").order("slide_index");
      if (!audios?.length) return json({ error: "A aula ainda não tem narração gerada. Abra a aula e toque a apresentação uma vez." });
      let started = 0;
      const errors: string[] = [];
      for (const a of audios) {
        if (!a.storage_path) continue;
        const { data: s } = await admin.storage.from(BUCKET).createSignedUrl(a.storage_path, 3600 * 2);
        if (!s?.signedUrl) continue;
        const res = await fetch("https://api.d-id.com/talks", {
          method: "POST",
          headers: didHeaders(),
          body: JSON.stringify({
            source_url: portrait_url,
            script: { type: "audio", audio_url: s.signedUrl },
            config: { stitch: true, fluent: true },
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.id) {
          errors.push(`Slide ${a.slide_index + 1}: ${body?.description || body?.message || res.status}`);
          if (res.status === 401 || res.status === 402 || res.status === 403) break;
          continue;
        }
        await admin.from("ai_content_artifacts").upsert({
          canonical_id, slide_index: a.slide_index, artifact_type: TYPE, status: "processing",
          storage_path: null, error_message: null,
          metadata: { provider: "d-id", talk_id: body.id, portrait_url },
        }, { onConflict: "canonical_id,slide_index,artifact_type" });
        started++;
      }
      return json({ started, errors });
    }

    // poll
    const { data: rows } = await admin.from("ai_content_artifacts")
      .select("slide_index, status, metadata, error_message").eq("canonical_id", canonical_id).eq("artifact_type", TYPE);
    for (const r of rows ?? []) {
      const talkId = (r.metadata as Record<string, unknown> | null)?.talk_id;
      if (r.status !== "processing" || typeof talkId !== "string") continue;
      const res = await fetch(`https://api.d-id.com/talks/${talkId}`, { headers: didHeaders() });
      const t = await res.json().catch(() => ({}));
      if (t.status === "done" && t.result_url) {
        const mp4 = new Uint8Array(await (await fetch(t.result_url)).arrayBuffer());
        const path = `neural/${canonical_id}/${r.slide_index}.mp4`;
        await admin.storage.from(BUCKET).upload(path, mp4, { contentType: "video/mp4", upsert: true });
        await admin.from("ai_content_artifacts").update({ status: "ready", storage_path: path })
          .eq("canonical_id", canonical_id).eq("slide_index", r.slide_index).eq("artifact_type", TYPE);
        r.status = "ready";
      } else if (t.status === "error" || t.status === "rejected") {
        const msg = t?.error?.description || "Falha na renderização";
        await admin.from("ai_content_artifacts").update({ status: "failed", error_message: msg })
          .eq("canonical_id", canonical_id).eq("slide_index", r.slide_index).eq("artifact_type", TYPE);
        r.status = "failed";
        r.error_message = msg;
      }
    }
    return json({ slides: (rows ?? []).map((r) => ({ slide: r.slide_index, status: r.status, error: r.error_message })) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado." });
  }
});
