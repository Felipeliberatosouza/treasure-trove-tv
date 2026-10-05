// Análise de foto: questão de prova -> resolução comentada; tema/assunto -> tema para gerar slides de revisão.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveModel } from "../_shared/ai-models.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tipo", "tema", "disciplina", "enunciado", "resposta_final", "solucao"],
  properties: {
    tipo: { type: "string", enum: ["questao", "tema", "ilegivel"] },
    tema: { type: "string" },
    disciplina: { type: "string" },
    enunciado: { type: "string" },
    resposta_final: { type: "string" },
    solucao: { type: "string" },
  },
};

const INSTRUCOES = `Você é professor brasileiro experiente. Analise a foto enviada pelo aluno.
- Se for uma QUESTÃO de prova/exercício: tipo="questao". Transcreva o enunciado (e alternativas) em "enunciado". Em "solucao" escreva uma resolução comentada DETALHADA em Markdown, passo a passo, explicando o raciocínio, os conceitos usados, por que a resposta correta está certa e, se houver alternativas, por que as outras estão erradas. Em "resposta_final" coloque a resposta/alternativa correta em uma linha.
- Se for um TEMA, ASSUNTO, página de livro, anotação ou conteúdo para estudar: tipo="tema". Em "tema" escreva um pedido curto e claro do assunto a revisar (ex.: "Mitose e meiose - fases e diferenças"). Deixe "solucao", "enunciado" e "resposta_final" vazios.
- Se a imagem estiver ilegível ou não tiver conteúdo educacional: tipo="ilegivel" e explique em "solucao" o que o aluno deve fazer (foto mais nítida, mais luz, enquadrar só a questão).
Sempre preencha "tema" e "disciplina" (melhor estimativa). Responda tudo em português do Brasil. Não trate de política, religião, futebol ou conteúdo impróprio.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const image = typeof body.image === "string" ? body.image : "";
    const nota = String(body.nota || "").slice(0, 500);
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(image)) return json(200, { ok: false, error: "Envie uma foto em JPG, PNG ou WEBP." });
    if (image.length > 8_000_000) return json(200, { ok: false, error: "A foto é muito grande. Tente uma foto menor." });

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json(200, { ok: false, error: "IA indisponível no momento." });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: await resolveModel("revisoes"),
        stream: true,
        store: false,
        reasoning: { effort: "medium" },
        text: { format: { type: "json_schema", name: "analise_foto", strict: true, schema: SCHEMA } },
        input: [
          { role: "system", content: [{ type: "input_text", text: INSTRUCOES }] },
          {
            role: "user",
            content: [
              { type: "input_text", text: nota ? `Observação do aluno: ${nota}` : "Analise esta foto." },
              { type: "input_image", image_url: image },
            ],
          },
        ],
      }),
    });
    if (!res.ok || !res.body) {
      console.error("photo-analyze gateway", res.status, (await res.text()).slice(0, 400));
      if (res.status === 429) return json(200, { ok: false, error: "Muitos pedidos agora. Tente novamente em instantes." });
      if (res.status === 402) return json(200, { ok: false, error: "Créditos de IA da plataforma esgotados. Fale com o suporte." });
      return json(200, { ok: false, error: "Não foi possível analisar a foto agora." });
    }

    // Lê o stream SSE e junta o texto final.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "", failed = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
          if (ev.type === "response.failed" || ev.type === "error") failed = true;
        } catch { /* parcial */ }
      }
    }
    if (failed || !text.trim()) return json(200, { ok: false, error: "Não foi possível analisar a foto. Tente outra foto." });
    const out = JSON.parse(text);
    return json(200, { ok: true, result: out });
  } catch (e) {
    console.error("photo-analyze", e);
    return json(200, { ok: false, error: "Erro inesperado ao analisar a foto." });
  }
});
