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

    // Voz fixa do avatar configurado no painel administrativo.
    const ALLOWED_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"];
    const avatarGender = body.avatar_gender === "male" ? "male" : "female";
    const requestedVoice = typeof body.avatar_voice === "string" ? body.avatar_voice.trim() : "";
    const voice = ALLOWED_VOICES.includes(requestedVoice)
      ? requestedVoice
      : (avatarGender === "male" ? "onyx" : "nova");

    // Assinatura simples do texto: o áudio é regerado quando a narração muda.
    const textSignature = (value: string) => {
      let hash = 0;
      for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
      return `${value.length}:${hash}`;
    };

    let cachedRow: { storage_path: string | null; metadata: Record<string, unknown> | null } | null = null;
    if (canonicalId && slideIndex !== null && slideIndex >= 0) {
      const { data: existing } = await admin
        .from("ai_content_artifacts")
        .select("storage_path, metadata")
        .eq("canonical_id", canonicalId)
        .eq("slide_index", slideIndex)
        .eq("artifact_type", "audio")
        .eq("status", "ready")
        .maybeSingle();
      cachedRow = existing as typeof cachedRow;
      const cachedVoice = (existing?.metadata as Record<string, unknown> | null)?.voice;
      if (false && existing?.storage_path && cachedVoice === voice) {
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

    const ageInstructions: Record<string, string> = {
      criancas_0_9: "Use ritmo alegre, frases simples, pausas claras e entonação acolhedora para crianças.",
      pre_adolescentes_10_13: "Use ritmo vivo, linguagem simples e tom encorajador para pré-adolescentes.",
      adolescentes_14_17: "Use ritmo direto, natural e motivador para adolescentes.",
      jovens_18_25: "Use ritmo claro, informal e didático para jovens universitários.",
      adultos_26_45: "Use ritmo objetivo, natural e didático para adultos.",
      adultos_46_mais: "Use ritmo mais calmo, articulação nítida e pausas confortáveis.",
    };
    const faixaEtaria = typeof body.faixa_etaria === "string" ? body.faixa_etaria : "jovens_18_25";
    const instructions = `${avatarGender === "male" ? "Fale com voz masculina, como um professor acolhedor." : "Fale com voz feminina, como uma professora acolhedora."} ${ageInstructions[faixaEtaria] || ageInstructions.jovens_18_25}`;

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
