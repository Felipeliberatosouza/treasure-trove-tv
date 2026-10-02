// Ferramentas de provas reais: comentários das questões (Resolução Comentada) e correção de redação/discursivas.
import { resolveModel } from "../_shared/ai-models.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function ai(system: string, user: string) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("IA indisponível no momento.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: await resolveModel("provas_reais"), reasoning_effort: "low", response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    console.error("exam-tools gateway", res.status, (await res.text()).slice(0, 300));
    if (res.status === 429) throw new Error("Muitos pedidos agora. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA da plataforma esgotados. Fale com o suporte.");
    throw new Error("Não foi possível usar a IA agora.");
  }
  const p = await res.json();
  const t = String(p?.choices?.[0]?.message?.content ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(t);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    const { data: u } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    const userId = u?.user?.id;
    if (!userId) return json(200, { ok: false, error: "Entre na sua conta para usar esta ferramenta." });
    const body = await req.json().catch(() => ({}));

    if (body.action === "comment") {
      const ids: string[] = (Array.isArray(body.question_ids) ? body.question_ids : []).slice(0, 10);
      const { data: qs } = await admin.from("real_exam_questions").select("id, number, subject, statement, options, correct, explanation").in("id", ids);
      const missing = (qs || []).filter((q: any) => !q.explanation);
      if (!missing.length) return json(200, { ok: true, items: [] });
      const out = await ai(
        "Você é professor brasileiro especialista em provas. Explique a resolução de questões oficiais em português claro e didático. Responda somente JSON.",
        `Para cada questão, escreva um comentário (4 a 8 frases) explicando o raciocínio, por que a alternativa correta está certa e por que as principais erradas estão erradas. Use o gabarito oficial informado.
Formato: {"items":[{"id":"...","comentario":"..."}]}
Questões: ${JSON.stringify(missing.map((q: any) => ({ id: q.id, numero: q.number, disciplina: q.subject, enunciado: String(q.statement).slice(0, 3000), alternativas: q.options, gabarito: q.correct })))}`,
      );
      const items = (out?.items || []).filter((i: any) => i?.id && i?.comentario && missing.some((m: any) => m.id === i.id));
      for (const i of items) await admin.from("real_exam_questions").update({ explanation: String(i.comentario).slice(0, 6000) }).eq("id", i.id);
      return json(200, { ok: true, items: items.map((i: any) => ({ id: i.id, explanation: i.comentario })) });
    }

    if (body.action === "grade_essay") {
      const text = String(body.essay_text || "").trim();
      if (text.length < 50) return json(200, { ok: false, error: "Escreva pelo menos algumas linhas para a correção." });
      const { data: prod } = await admin.from("products").select("name, simulado_config").eq("key", String(body.product_key || "")).maybeSingle();
      const criteria = (prod?.simulado_config as any)?.essay_criteria || "Critérios gerais de correção de redação.";
      const result = await ai(
        "Você é corretor oficial experiente de provas brasileiras. Corrija com rigor e justiça, seguindo exatamente os critérios informados. Responda somente JSON.",
        `Prova: ${prod?.name || ""} ${body.option ? `(${body.option})` : ""}
Critérios oficiais: ${criteria}
Tema/enunciado informado pelo aluno: ${String(body.tema || "não informado").slice(0, 1000)}
Formato: {"nota_total":number,"nota_maxima":number,"criterios":[{"nome":"...","nota":number,"maximo":number,"comentario":"..."}],"pontos_fortes":["..."],"melhorias":["..."]}
Texto do aluno:
${text.slice(0, 20000)}`,
      );
      if (body.attempt_id) {
        await admin.from("exam_attempts").update({ essay_text: text, essay_result: result }).eq("id", body.attempt_id).eq("user_id", userId);
      }
      return json(200, { ok: true, result });
    }
    return json(200, { ok: false, error: "Ação inválida." });
  } catch (e) {
    console.error("exam-tools", e);
    return json(200, { ok: false, error: (e as Error).message || "Erro inesperado." });
  }
});
