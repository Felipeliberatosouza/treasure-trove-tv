// Narração por IA. Kits canônicos recebem áudio persistente e reutilizável;
// o modo legado de "Estudar com IA" continua aceitando texto autenticado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const body = await req.json();
    const canonicalId = typeof body.canonical_id === "string" ? body.canonical_id : null;
    const slideIndex = Number.isInteger(body.slide_index) ? body.slide_index : null;
    let texto = typeof body.texto === "string" ? body.texto.trim() : "";

    // Voz coerente com o avatar configurado no painel administrativo.
    const avatarGender = body.avatar_gender === "male" ? "male" : "female";
    const voice = avatarGender === "male" ? "onyx" : "nova";

    if (canonicalId && slideIndex !== null && slideIndex >= 0) {
      const { data: existing } = await admin
        .from("ai_content_artifacts")
        .select("storage_path, metadata")
        .eq("canonical_id", canonicalId)
        .eq("slide_index", slideIndex)
        .eq("artifact_type", "audio")
        .eq("status", "ready")
        .maybeSingle();
      const cachedVoice = (existing?.metadata as Record<string, unknown> | null)?.voice;
      if (existing?.storage_path && cachedVoice === voice) {
        const { data: signed } = await admin.storage.from("ai-revision-media").createSignedUrl(existing.storage_path, 3600);
        if (signed?.signedUrl) {
          return new Response(JSON.stringify({ audio_url: signed.signedUrl, cached: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data: canonical } = await admin
        .from("ai_canonical_contents")
        .select("kit, status, visibility")
        .eq("id", canonicalId)
        .eq("status", "ready")
        .eq("visibility", "public_canonical")
        .maybeSingle();
      const slides = Array.isArray(canonical?.kit?.slides) ? canonical.kit.slides : [];
      texto = typeof slides[slideIndex]?.narracao === "string" ? slides[slideIndex].narracao.trim() : "";
      if (!texto) {
        return new Response(JSON.stringify({ error: "Narração não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await admin.from("ai_content_artifacts").upsert({
        canonical_id: canonicalId,
        slide_index: slideIndex,
        artifact_type: "audio",
        status: "processing",
      }, { onConflict: "canonical_id,slide_index,artifact_type" });
    } else {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user?.id) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!texto) {
      return new Response(JSON.stringify({ error: "Texto vazio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const instructions = avatarGender === "male"
      ? "Fale em português brasileiro, com voz masculina, como um professor universitário acolhedor e didático, com ritmo claro e pausas naturais."
      : "Fale em português brasileiro, com voz feminina, como uma professora universitária acolhedora e didática, com ritmo claro e pausas naturais.";

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: texto,
        voice,
        instructions,
        response_format: "mp3",
        stream_format: "audio",
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok || !aiResp.body) {
      const t = await aiResp.text().catch(() => "");
      console.error("tts error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Falha ao gerar narração" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (canonicalId && slideIndex !== null) {
      const audio = new Uint8Array(await aiResp.arrayBuffer());
      const storagePath = `${canonicalId}/slides/${slideIndex}.mp3`;
      const { error: uploadError } = await admin.storage
        .from("ai-revision-media")
        .upload(storagePath, audio, { contentType: "audio/mpeg", upsert: true });
      if (uploadError) throw uploadError;
      await admin.from("ai_content_artifacts").upsert({
        canonical_id: canonicalId,
        slide_index: slideIndex,
        artifact_type: "audio",
        status: "ready",
        storage_path: storagePath,
        metadata: { voice, model: "openai/gpt-4o-mini-tts" },
      }, { onConflict: "canonical_id,slide_index,artifact_type" });
      const { data: signed } = await admin.storage.from("ai-revision-media").createSignedUrl(storagePath, 3600);
      return new Response(JSON.stringify({ audio_url: signed?.signedUrl, cached: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compatibilidade com o player legado.
    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("study-tts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
