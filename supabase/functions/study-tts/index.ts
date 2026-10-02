// Narração por IA. Kits canônicos recebem áudio persistente e reutilizável;
// o modo legado de "Estudar com IA" continua aceitando texto autenticado.
// Provedor de voz definido em Gestão de IA (platform_settings.ai_voice_config):
// - "elevenlabs": voz humana + tempos de cada letra (sincronia labial e legenda);
// - "openai" (padrão): voz atual. Se a ElevenLabs falhar, cai para a OpenAI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { loadSetting } from "../_shared/ai-models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const DEFAULT_EL_FEMALE = "Xb7hH8MSUJpSbSDYk0k2"; // Alice
const DEFAULT_EL_MALE = "onwK4e9ZLuTAKqWW03F9"; // Daniel
const EL_ID_RE = /^[A-Za-z0-9]{10,40}$/;

type Alignment = { chars: string; starts: number[]; ends: number[] };

const num = (v: unknown, def: number, min: number, max: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

async function elevenLabsSpeech(text: string, voiceId: string, cfg: Record<string, unknown>) {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) throw new Error("ElevenLabs não conectada");
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        language_code: "pt",
        voice_settings: {
          stability: num(cfg.stability, 0.5, 0, 1),
          similarity_boost: num(cfg.similarity, 0.75, 0, 1),
          style: num(cfg.style, 0.35, 0, 1),
          use_speaker_boost: true,
          speed: num(cfg.speed, 1, 0.7, 1.2),
        },
      }),
    },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`ElevenLabs [${res.status}]: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const audio = base64Decode(data.audio_base64 as string);
  const al = data.alignment || data.normalized_alignment;
  let alignment: Alignment | null = null;
  if (al?.characters?.length) {
    alignment = {
      chars: (al.characters as string[]).join(""),
      starts: (al.character_start_times_seconds as number[]).map((s) => Math.round(s * 1000)),
      ends: (al.character_end_times_seconds as number[]).map((s) => Math.round(s * 1000)),
    };
  }
  return { audio, alignment };
}

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

    const ALLOWED_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"];
    const avatarGender = body.avatar_gender === "male" ? "male" : "female";
    const requestedVoice = typeof body.avatar_voice === "string" ? body.avatar_voice.trim() : "";
    const openaiVoice = ALLOWED_VOICES.includes(requestedVoice)
      ? requestedVoice
      : (avatarGender === "male" ? "onyx" : "nova");

    // Configuração de voz do painel.
    const voiceCfg = await loadSetting("ai_voice_config");
    const useEleven = voiceCfg.provider === "elevenlabs" && !!Deno.env.get("ELEVENLABS_API_KEY");
    const avatarElId = typeof body.avatar_el_voice === "string" ? body.avatar_el_voice.trim() : "";
    const rawElId = EL_ID_RE.test(avatarElId)
      ? avatarElId
      : String(avatarGender === "male" ? voiceCfg.male_voice_id || "" : voiceCfg.female_voice_id || "");
    const elVoiceId = EL_ID_RE.test(rawElId) ? rawElId : (avatarGender === "male" ? DEFAULT_EL_MALE : DEFAULT_EL_FEMALE);
    const elSettingsSig = [voiceCfg.stability, voiceCfg.similarity, voiceCfg.style, voiceCfg.speed].join("|");
    const voiceKey = useEleven ? `el:${elVoiceId}:${elSettingsSig}` : openaiVoice;

    const textSignature = (value: string) => {
      let hash = 0;
      for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
      return `${value.length}:${hash}`;
    };

    let signature = "";
    if (canonicalId && slideIndex !== null && slideIndex >= 0) {
      const { data: canonical } = await admin
        .from("ai_canonical_contents")
        .select("kit, status, visibility")
        .eq("id", canonicalId)
        .eq("status", "ready")
        .eq("visibility", "public_canonical")
        .maybeSingle();
      const slides = Array.isArray(canonical?.kit?.slides) ? canonical.kit.slides : [];
      texto = typeof slides[slideIndex]?.narracao === "string" ? slides[slideIndex].narracao.trim() : "";
      if (!texto) return json({ error: "Narração não encontrada" }, 404);
      signature = textSignature(texto);

      const { data: existing } = await admin
        .from("ai_content_artifacts")
        .select("storage_path, metadata")
        .eq("canonical_id", canonicalId)
        .eq("slide_index", slideIndex)
        .eq("artifact_type", "audio")
        .eq("status", "ready")
        .maybeSingle();
      const meta = (existing?.metadata as Record<string, unknown> | null) ?? null;
      if (existing?.storage_path && meta?.voice === voiceKey && meta?.text_signature === signature) {
        const { data: signed } = await admin.storage.from("ai-revision-media").createSignedUrl(existing.storage_path, 3600);
        if (signed?.signedUrl) {
          return json({ audio_url: signed.signedUrl, cached: true, alignment: meta?.alignment ?? null, provider: meta?.provider ?? "openai" });
        }
      }

      await admin.from("ai_content_artifacts").upsert({
        canonical_id: canonicalId,
        slide_index: slideIndex,
        artifact_type: "audio",
        status: "processing",
      }, { onConflict: "canonical_id,slide_index,artifact_type" });
    } else {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user?.id) return json({ error: "Não autenticado" }, 401);
    }

    if (!texto) return json({ error: "Texto vazio" }, 400);
    const finalText = `${texto}${/[.!?…]$/.test(texto) ? "" : "."}`;

    let audio: Uint8Array | null = null;
    let alignment: Alignment | null = null;
    let provider = "openai";
    let usedVoice = openaiVoice;

    if (useEleven) {
      try {
        const r = await elevenLabsSpeech(finalText, elVoiceId, voiceCfg);
        audio = r.audio;
        alignment = r.alignment;
        provider = "elevenlabs";
        usedVoice = voiceKey;
      } catch (e) {
        // Reserva automática: o aluno nunca fica sem narração.
        console.error("elevenlabs fallback:", e instanceof Error ? e.message : e);
      }
    }

    if (!audio) {
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
      const instructions = [
        avatarGender === "male" ? "Fale com voz masculina, como um professor acolhedor." : "Fale com voz feminina, como uma professora acolhedora.",
        ageInstructions[faixaEtaria] || ageInstructions.jovens_18_25,
        "Leia o texto inteiro, do começo ao fim, incluindo a última frase de despedida. Não resuma, não pule e não corte nenhuma frase.",
      ].join(" ");

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini-tts",
          input: `${finalText} `,
          voice: openaiVoice,
          instructions,
          response_format: "mp3",
          stream_format: "audio",
        }),
      });
      if (aiResp.status === 429) return json({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }, 429);
      if (aiResp.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      if (!aiResp.ok) {
        const t = await aiResp.text().catch(() => "");
        console.error("tts error", aiResp.status, t);
        return json({ error: "Falha ao gerar narração" }, 502);
      }
      audio = new Uint8Array(await aiResp.arrayBuffer());
      // A voz reserva não é guardada como definitiva quando a ElevenLabs está ativa,
      // para que a próxima visita tente de novo a voz escolhida.
      usedVoice = useEleven ? `fallback:${openaiVoice}` : openaiVoice;
    }

    if (canonicalId && slideIndex !== null) {
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
        metadata: {
          voice: usedVoice,
          provider,
          model: provider === "elevenlabs" ? "eleven_multilingual_v2" : "openai/gpt-4o-mini-tts",
          text_signature: signature || textSignature(texto),
          alignment,
        },
      }, { onConflict: "canonical_id,slide_index,artifact_type" });
      const { data: signed } = await admin.storage.from("ai-revision-media").createSignedUrl(storagePath, 3600);
      return json({ audio_url: signed?.signedUrl, cached: false, alignment, provider });
    }

    // Compatibilidade com o player legado (áudio direto).
    return new Response(audio, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("study-tts error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
