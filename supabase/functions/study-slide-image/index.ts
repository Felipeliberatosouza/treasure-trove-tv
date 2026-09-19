// Imagem didática persistente para cada slide de um material canônico.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const canonicalId = typeof body.canonical_id === "string" ? body.canonical_id : "";
    // slide_index === -1 identifica a capa única do material.
    const slideIndex = Number.isInteger(body.slide_index) ? body.slide_index : -2;
    const isCover = slideIndex === -1;
    if (!canonicalId || slideIndex < -1) return json({ error: "Slide inválido." }, 400);
    const artifactType = isCover ? "cover" : "image";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    // A capa é guardada com slide_index 0 e tipo "cover" (a coluna exige índice >= 0).
    const dbIndex = isCover ? 0 : slideIndex;
    const { data: existing } = await admin
      .from("ai_content_artifacts")
      .select("storage_path")
      .eq("canonical_id", canonicalId)
      .eq("slide_index", dbIndex)
      .eq("artifact_type", artifactType)
      .eq("status", "ready")
      .maybeSingle();
    if (existing?.storage_path) {
      const { data: signed } = await admin.storage.from("ai-revision-media").createSignedUrl(existing.storage_path, 3600);
      if (signed?.signedUrl) return json({ image_url: signed.signedUrl, cached: true });
    }

    const { data: canonical } = await admin
      .from("ai_canonical_contents")
      .select("kit, assunto, faixa_etaria, status, visibility")
      .eq("id", canonicalId)
      .eq("status", "ready")
      .eq("visibility", "public_canonical")
      .maybeSingle();
    const slides = Array.isArray(canonical?.kit?.slides) ? canonical.kit.slides : [];
    const slide = slides[slideIndex];
    if (!slide) return json({ error: "Slide não encontrado." }, 404);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Serviço de imagens indisponível." }, 500);
    await admin.from("ai_content_artifacts").upsert({
      canonical_id: canonicalId,
      slide_index: slideIndex,
      artifact_type: "image",
      status: "processing",
    }, { onConflict: "canonical_id,slide_index,artifact_type" });

    const prompt = [
      "Imagem educacional horizontal 16:9 para uma aula da Revisão Fácil.",
      `Assunto: ${canonical.assunto}.`,
      `Público: ${canonical.faixa_etaria}.`,
      slide.imagem_prompt || slide.titulo,
      "Composição clara, didática, apropriada para a idade, sem palavras, letras, números, marcas ou logotipos.",
    ].join(" ");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-image-2.5-sunburst", prompt, size: "1536x1024" }),
    });
    if (response.status === 429) return json({ error: "Limite de imagens atingido. Tente novamente mais tarde." }, 429);
    if (response.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      console.error("slide image error", response.status, message);
      await admin.from("ai_content_artifacts").update({ status: "failed" }).eq("canonical_id", canonicalId).eq("slide_index", slideIndex).eq("artifact_type", "image");
      return json({ error: "Não foi possível gerar a imagem do slide." }, response.status >= 500 ? 502 : response.status);
    }
    const payload = await response.json();
    const b64 = payload?.data?.[0]?.b64_json;
    if (typeof b64 !== "string") return json({ error: "A imagem não foi retornada." }, 502);
    const bytes = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
    const storagePath = `${canonicalId}/slides/${slideIndex}.png`;
    const { error: uploadError } = await admin.storage.from("ai-revision-media").upload(storagePath, bytes, { contentType: "image/png", upsert: true });
    if (uploadError) throw uploadError;
    await admin.from("ai_content_artifacts").upsert({
      canonical_id: canonicalId,
      slide_index: slideIndex,
      artifact_type: "image",
      status: "ready",
      storage_path: storagePath,
      metadata: { model: "openai/gpt-image-2.5-sunburst", faixa_etaria: canonical.faixa_etaria },
    }, { onConflict: "canonical_id,slide_index,artifact_type" });
    const { data: signed } = await admin.storage.from("ai-revision-media").createSignedUrl(storagePath, 3600);
    return json({ image_url: signed?.signedUrl ?? null, cached: false });
  } catch (error) {
    console.error("study-slide-image error", error);
    return json({ error: error instanceof Error ? error.message : "Erro inesperado." }, 500);
  }
});