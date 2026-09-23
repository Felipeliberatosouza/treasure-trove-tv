// Trabalhos com IA — gera conteúdo para documento Word e slides de apresentação.
// Ações (POST): { action: "generate" | "revise" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEN_MODEL = "openai/gpt-6-astra";
const PROMPT_VERSION = "w1";

interface Pricing {
  credits_generation: number;
  credits_interaction: number;
  provider_cost_generation: number;
  provider_cost_interaction: number;
  price_generation: number;
  price_interaction: number;
}

const DEFAULT_PRICING: Pricing = {
  credits_generation: 2,
  credits_interaction: 1,
  provider_cost_generation: 0.35,
  provider_cost_interaction: 0.12,
  price_generation: 4.9,
  price_interaction: 1.9,
};

function normalize(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SCHEMA = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    tema: { type: "string" },
    resumo_executivo: { type: "string" },
    introducao: { type: "string" },
    secoes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          paragrafos: { type: "array", items: { type: "string" } },
          imagem_sugerida: { type: "string" },
        },
        required: ["titulo", "paragrafos"],
      },
    },
    conclusao: { type: "string" },
    referencias: { type: "array", items: { type: "string" } },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
          nota_apresentador: { type: "string" },
        },
        required: ["titulo", "bullets"],
      },
    },
  },
  required: ["titulo", "secoes", "slides"],
};

async function callGateway(system: string, user: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("Configuração de IA indisponível no momento.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GEN_MODEL,
      stream: false,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `${user}\n\nResponda somente com um objeto JSON válido conforme este esquema: ${JSON.stringify(SCHEMA)}.` },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("work-document gateway error", res.status, detail.slice(0, 400));
    if (res.status === 429) throw new Error("Muitos pedidos agora. Aguarde um instante e tente novamente.");
    if (res.status === 402) throw new Error("Créditos de IA da plataforma esgotados. Fale com o suporte.");
    throw new Error("Não foi possível gerar o trabalho agora. Tente novamente em instantes.");
  }
  const payload = await res.json();
  const text: string = payload?.choices?.[0]?.message?.content ?? "";
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!clean) throw new Error("A IA não retornou o trabalho.");
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error("A IA retornou um conteúdo inválido. Tente novamente.");
  }
}

const SYSTEM = `Você é um redator acadêmico brasileiro que produz trabalhos escolares e universitários em português do Brasil.
Regras:
- Escreva conteúdo original, claro e bem estruturado, adequado ao nível informado.
- Nunca cite pessoas físicas ou empresas reais de forma polêmica; evite religião, política partidária e futebol.
- Não invente dados estatísticos específicos nem referências falsas: nas referências, indique apenas obras e fontes amplamente conhecidas ou oriente a consulta ao material da disciplina.
- O documento Word deve ter seções completas com parágrafos desenvolvidos.
- Os slides devem ser objetivos: 3 a 5 bullets curtos por slide e uma nota do apresentador.`;

async function handle(req: Request, body: any): Promise<{ status: number; payload: unknown }> {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  let userId: string | null = null;
  if (token) {
    const { data } = await admin.auth.getUser(token);
    userId = data.user?.id ?? null;
  }
  if (!userId) {
    return { status: 401, payload: { error: "signup_required", message: "Crie sua conta para gerar trabalhos com IA." } };
  }

  const { data: settingRow } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "work_documents_pricing")
    .maybeSingle();
  const pricing: Pricing = { ...DEFAULT_PRICING, ...((settingRow?.value as Partial<Pricing>) ?? {}) };

  async function ensureCredits() {
    const { data: row } = await admin
      .from("ai_revision_credits")
      .select("user_id, balance")
      .eq("user_id", userId!)
      .maybeSingle();
    if (row) return row as { user_id: string; balance: number };
    const { data: created } = await admin
      .from("ai_revision_credits")
      .insert({ user_id: userId!, balance: 0, signup_granted: true })
      .select("user_id, balance")
      .single();
    return created as { user_id: string; balance: number };
  }

  async function debit(amount: number, reason: string) {
    if (amount <= 0) return { ok: true as const, balance: null };
    const credits = await ensureCredits();
    if ((credits.balance ?? 0) < amount) return { ok: false as const, balance: credits.balance ?? 0 };
    const next = credits.balance - amount;
    await admin.from("ai_revision_credits").update({ balance: next }).eq("user_id", userId!);
    await admin.from("ai_revision_credit_ledger").insert({
      user_id: userId!, delta: -amount, reason, balance_after: next,
    });
    return { ok: true as const, balance: next };
  }

  const action = body.action === "revise" ? "revise" : "generate";

  if (action === "generate") {
    const tema = String(body.tema || "").trim();
    if (tema.length < 3 || tema.length > 500) {
      return { status: 400, payload: { error: "Descreva o tema do trabalho (entre 3 e 500 caracteres)." } };
    }
    const disciplina = String(body.disciplina || "").trim().slice(0, 120) || null;
    const curso = String(body.curso || "").trim().slice(0, 160) || null;
    const instituicao = String(body.instituicao || "").trim().slice(0, 160) || null;
    const tipo = ["word", "slides", "ambos"].includes(body.tipo) ? body.tipo : "ambos";

    const cacheKey = [normalize(tema), normalize(disciplina || ""), normalize(curso || ""), tipo, PROMPT_VERSION].join("|");

    // Reaproveita conteúdo já produzido (reduz custo de IA); nunca expõe o trabalho de outro aluno.
    const { data: cached } = await admin
      .from("work_documents")
      .select("content, titulo")
      .eq("cache_key", cacheKey)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const debited = await debit(pricing.credits_generation, "work_generate");
    if (!debited.ok) {
      return {
        status: 402,
        payload: { error: "paywall", message: "Seus Créditos de IA acabaram." },
      };
    }

    let content: any = cached?.content ?? null;
    let reused = Boolean(content);
    if (!content) {
      try {
        content = await callGateway(
          SYSTEM,
          `Produza um trabalho acadêmico completo.
Tema: ${tema}
Disciplina: ${disciplina || "não informada"}
Curso/nível: ${curso || "não informado"}
Instituição: ${instituicao || "não informada"}
Formato pedido: ${tipo === "word" ? "somente documento" : tipo === "slides" ? "somente slides" : "documento e slides"}
Produza de 4 a 6 seções no documento e de 7 a 10 slides.`,
        );
      } catch (e) {
        // Estorna o Crédito de IA quando a geração falha.
        const credits = await ensureCredits();
        const back = (credits.balance ?? 0) + pricing.credits_generation;
        await admin.from("ai_revision_credits").update({ balance: back }).eq("user_id", userId!);
        await admin.from("ai_revision_credit_ledger").insert({
          user_id: userId!, delta: pricing.credits_generation, reason: "work_refund", balance_after: back,
        });
        return { status: 500, payload: { error: (e as Error).message } };
      }
      reused = false;
    }

    const { data: inserted, error } = await admin
      .from("work_documents")
      .insert({
        user_id: userId,
        cache_key: cacheKey,
        titulo: String(content?.titulo || tema).slice(0, 200),
        tema,
        tipo,
        disciplina,
        curso,
        instituicao,
        content,
        credits_spent: pricing.credits_generation,
        provider_cost: reused ? 0 : pricing.provider_cost_generation,
        reused,
      })
      .select("id")
      .single();
    if (error) {
      console.error("work-document insert error", error);
      return { status: 500, payload: { error: "Não foi possível salvar o trabalho." } };
    }

    return { status: 200, payload: { id: inserted.id, content, reused, balance: debited.balance } };
  }

  // ------- revisão solicitada pelo aluno -------
  const documentId = String(body.document_id || "");
  const instrucao = String(body.instrucao || "").trim();
  if (!documentId || instrucao.length < 3) {
    return { status: 400, payload: { error: "Descreva o ajuste desejado." } };
  }
  const { data: doc } = await admin
    .from("work_documents")
    .select("id, user_id, tema, disciplina, curso, content, provider_cost, credits_spent")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc || doc.user_id !== userId) {
    return { status: 404, payload: { error: "Trabalho não encontrado." } };
  }

  const debited = await debit(pricing.credits_interaction, "work_revise");
  if (!debited.ok) {
    return { status: 402, payload: { error: "paywall", message: "Seus Créditos de IA acabaram." } };
  }

  let content: any;
  try {
    content = await callGateway(
      SYSTEM,
      `Ajuste o trabalho abaixo conforme o pedido do aluno, mantendo a mesma estrutura de campos.
Pedido do aluno: ${instrucao}
Tema: ${doc.tema}
Disciplina: ${doc.disciplina || "não informada"}

Conteúdo atual (JSON):
${JSON.stringify(doc.content).slice(0, 60000)}`,
    );
  } catch (e) {
    const credits = await ensureCredits();
    const back = (credits.balance ?? 0) + pricing.credits_interaction;
    await admin.from("ai_revision_credits").update({ balance: back }).eq("user_id", userId!);
    await admin.from("ai_revision_credit_ledger").insert({
      user_id: userId!, delta: pricing.credits_interaction, reason: "work_refund", balance_after: back,
    });
    return { status: 500, payload: { error: (e as Error).message } };
  }

  await admin
    .from("work_documents")
    .update({
      content,
      titulo: String(content?.titulo || doc.tema).slice(0, 200),
      credits_spent: (doc.credits_spent ?? 0) + pricing.credits_interaction,
      provider_cost: Number(doc.provider_cost ?? 0) + pricing.provider_cost_interaction,
      updated_at: new Date().toISOString(),
    })
    .eq("id", doc.id);

  await admin.from("work_document_messages").insert([
    { document_id: doc.id, role: "user", content: instrucao, credits_spent: pricing.credits_interaction },
    { document_id: doc.id, role: "ai", content: "Ajuste aplicado ao trabalho.", credits_spent: 0 },
  ]);

  return { status: 200, payload: { id: doc.id, content, balance: debited.balance } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Mantém a conexão viva com "pings" enquanto a IA trabalha.
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode(JSON.stringify({ type: "ping" }) + "\n"));
        } catch { /* fechado */ }
      }, 5000);
      let result: { status: number; payload: unknown };
      try {
        result = await handle(req, body);
      } catch (e) {
        console.error("work-document error", e);
        result = { status: 500, payload: { error: (e as Error).message || "Erro inesperado." } };
      }
      clearInterval(ping);
      controller.enqueue(enc.encode(JSON.stringify({ type: "result", ...result }) + "\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "application/x-ndjson" },
  });
});
