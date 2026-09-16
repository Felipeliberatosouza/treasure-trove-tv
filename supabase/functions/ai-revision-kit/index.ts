// Kit de Revisão com IA — cache canônico + créditos server-side + geração.
// Endpoints (POST):
//   { action: "status", anon_id }            -> saldo/elegibilidade
//   { action: "generate", ...campos }        -> entrega kit (cache ou geração)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEN_MODEL = "google/gemini-3.7-flash";
const TEMPLATE_VERSION = "v2";
const PROMPT_VERSION = "v2";
const SIGNUP_CREDITS = 2;
const ANON_FREE_USES = 1;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalize(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCacheKey(input: { disciplina?: string; assunto: string; nivel: string }) {
  return [
    normalize(input.disciplina || "geral"),
    normalize(input.assunto),
    "pt-br",
    normalize(input.nivel || "rapido"),
    TEMPLATE_VERSION,
    PROMPT_VERSION,
  ].join("|");
}

const KIT_TOOL = {
  type: "function",
  function: {
    name: "entregar_kit_revisao",
    description: "Entrega o Kit de Revisão completo em português brasileiro.",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        disciplina: { type: "string" },
        assunto: { type: "string" },
        subtopicos: { type: "array", items: { type: "string" } },
        resumo: {
          type: "array",
          description: "Seções do resumo (4 a 7 seções).",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              conteudo: { type: "string" },
            },
            required: ["titulo", "conteudo"],
          },
        },
        conceitos_chave: { type: "array", items: { type: "string" } },
        exemplos: { type: "array", items: { type: "string" } },
        pontos_de_atencao: { type: "array", items: { type: "string" } },
        colinha: { type: "array", items: { type: "string" }, description: "8 a 12 bullets curtos." },
        simulado: {
          type: "array",
          description: "5 questões de múltipla escolha.",
          items: {
            type: "object",
            properties: {
              enunciado: { type: "string" },
              alternativas: { type: "array", items: { type: "string" } },
              resposta_correta: { type: "integer" },
              explicacao: { type: "string" },
              subtopico: { type: "string" },
              dificuldade: { type: "string" },
            },
            required: ["enunciado", "alternativas", "resposta_correta", "explicacao"],
          },
        },
        top_questoes: {
          type: "array",
          description: "3 a 5 questões abertas com gabarito comentado.",
          items: {
            type: "object",
            properties: {
              enunciado: { type: "string" },
              gabarito: { type: "string" },
              subtopico: { type: "string" },
              dificuldade: { type: "string" },
            },
            required: ["enunciado", "gabarito"],
          },
        },
        slides: {
          type: "array",
          description: "6 a 8 slides: o primeiro é a introdução e o último o encerramento, seguindo o padrão pedido.",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
              narracao: { type: "string" },
              imagem_prompt: { type: "string", description: "Descrição objetiva da imagem didática que representa este slide, sem texto escrito." },
            },
            required: ["titulo", "bullets", "narracao", "imagem_prompt"],
          },
        },
      },
      required: ["titulo", "assunto", "resumo", "conceitos_chave", "colinha", "simulado", "top_questoes", "slides"],
    },
  },
};

async function generateKit(apiKey: string, params: {
  assunto: string;
  disciplina?: string;
  curso?: string;
  instituicao?: string;
  nivel: string;
}) {
  const system = `Você é um professor virtual brasileiro da Revisão Fácil que grava revisões rápidas para provas de graduação.
Escreva em português brasileiro, com linguagem informal, leve e direcionada a universitários.
Não invente fontes nem dados específicos de instituições.

REGRAS DE LINGUAGEM (obrigatórias):
- Use linguagem neutra em gênero: "se prepare para a prova" em vez de "esteja preparado".
- Nunca use palavras de baixo calão, alusões sexuais, conteúdo racista, preconceituoso ou temas polêmicos (futebol, religião, política).
- Nunca cite nomes de pessoas físicas ou jurídicas reais.

PADRÃO DA NARRAÇÃO DOS SLIDES (obrigatório):
- Slide 1 (introdução): narração no estilo "Olá, pessoal! Sejam bem-vindos a este rápido resumo essencial para a sua prova de [assunto]. Em poucos minutos vamos revisar os pontos-chave que você precisa dominar e arrebentar na prova! Vamos lá? Cola aqui que você vai bem!". Deixe claro que é uma revisão com os pontos essenciais para a prova.
- Slides do meio: conceitos-chave e conteúdos de prova, sempre com exemplos reais do dia a dia (não só teoria) e com frases descontraídas espalhadas, como "Isso tem alta chance de cair na sua prova...", "Presta atenção aqui, dica de prova!", "Atenção a esse ponto, cai sempre em provas...".
- Último slide (encerramento): reforce os pontos mais importantes do conteúdo, peça para o aluno deixar a dúvida (um professor responde), compartilhar a revisão com os colegas e avaliar o vídeo, e sugira fazer o simulado, ver as Top Questões resolvidas e marcar uma aula com um professor. Termine com "Boa prova!".`;
  const user = `Monte um Kit de Revisão completo.
Assunto informado pelo aluno: ${params.assunto}
Disciplina: ${params.disciplina || "não informada"}
Curso: ${params.curso || "não informado"}
Instituição: ${params.instituicao || "não informada"}
Profundidade: ${params.nivel === "aprofundado" ? "aprofundada" : "revisão rápida"}
Gere de 6 a 8 slides seguindo exatamente o padrão de narração: slide 1 de introdução, slides do meio com conceitos-chave e conteúdos de prova (com exemplos do dia a dia e frases descontraídas de dica de prova) e o último slide de encerramento.
Nos slides do meio, relacione os pontos com as questões mais prováveis, no mesmo espírito das Top Questões.
Em cada slide, escreva uma narração fluida em português brasileiro informal e uma direção de imagem didática diretamente relacionada ao tópico (no primeiro e no último slide a imagem é apenas de ambiente, sem conteúdo escrito).`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEN_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [KIT_TOOL],
      tool_choice: { type: "function", function: { name: "entregar_kit_revisao" } },
    }),
  });
  if (resp.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
  if (resp.status === 402) throw new Error("Créditos de IA da plataforma esgotados.");
  if (!resp.ok) {
    console.error("gateway error", resp.status, await resp.text().catch(() => ""));
    throw new Error("Falha ao gerar o Kit de Revisão.");
  }
  const data = await resp.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("A IA não retornou o Kit de Revisão.");
  return JSON.parse(args);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action === "status" ? "status" : "generate";
    const anonId = typeof body.anon_id === "string" ? body.anon_id.slice(0, 64) : null;

    // --- identifica usuário (opcional) ---
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (token) {
      const { data } = await admin.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    // --- garante e lê créditos ---
    async function ensureCredits(uid: string) {
      const { data: row } = await admin
        .from("ai_revision_credits")
        .select("user_id, balance, signup_granted")
        .eq("user_id", uid)
        .maybeSingle();
      if (row) return row;
      const { data: created } = await admin
        .from("ai_revision_credits")
        .insert({ user_id: uid, balance: SIGNUP_CREDITS, signup_granted: true })
        .select("user_id, balance, signup_granted")
        .single();
      await admin.from("ai_revision_credit_ledger").insert({
        user_id: uid,
        delta: SIGNUP_CREDITS,
        reason: "signup_grant",
        balance_after: SIGNUP_CREDITS,
      });
      return created!;
    }

    async function anonUsed() {
      if (!anonId) return 0;
      const { count } = await admin
        .from("ai_revision_requests")
        .select("id", { count: "exact", head: true })
        .eq("anon_id", anonId)
        .eq("source", "generated");
      return count ?? 0;
    }

    if (action === "status") {
      if (userId) {
        const credits = await ensureCredits(userId);
        return json({ authenticated: true, balance: credits.balance, anon_free_left: 0 });
      }
      const used = await anonUsed();
      return json({
        authenticated: false,
        balance: 0,
        anon_free_left: Math.max(ANON_FREE_USES - used, 0),
      });
    }

    // ------- geração -------
    const assunto = String(body.assunto || "").trim();
    if (assunto.length < 3 || assunto.length > 500) {
      return json({ error: "Descreva o assunto da prova (entre 3 e 500 caracteres)." }, 400);
    }
    const disciplina = String(body.disciplina || "").trim().slice(0, 120) || null;
    const curso = String(body.curso || "").trim().slice(0, 120) || null;
    const instituicao = String(body.instituicao || "").trim().slice(0, 120) || null;
    const examDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.exam_date || "")) ? body.exam_date : null;
    const nivel = body.nivel === "aprofundado" ? "aprofundado" : "rapido";
    const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key.slice(0, 80) : null;

    const cacheKey = buildCacheKey({ disciplina: disciplina || undefined, assunto, nivel });

    // Idempotência: mesmo clique duplicado devolve o mesmo pedido.
    if (idempotencyKey) {
      const { data: existing } = await admin
        .from("ai_revision_requests")
        .select("id, canonical_id, source, status")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing?.canonical_id) {
        const { data: content } = await admin
          .from("ai_canonical_contents")
          .select("id, kit")
          .eq("id", existing.canonical_id)
          .maybeSingle();
        if (content) {
          return json({ source: existing.source, request_id: existing.id, canonical_id: content.id, kit: content.kit });
        }
      }
    }

    // 1) cache canônico primeiro — nunca consome crédito
    const { data: cached } = await admin
      .from("ai_canonical_contents")
      .select("id, kit, status, visibility, hits")
      .eq("cache_key", cacheKey)
      .eq("visibility", "public_canonical")
      .eq("status", "ready")
      .maybeSingle();

    if (cached) {
      const { data: reqRow } = await admin
        .from("ai_revision_requests")
        .insert({
          user_id: userId, anon_id: anonId, prompt: assunto, disciplina, curso, instituicao,
          exam_date: examDate, nivel, cache_key: cacheKey, canonical_id: cached.id,
          source: "cache", status: "ready", idempotency_key: idempotencyKey,
        })
        .select("id")
        .single();
      await admin
        .from("ai_canonical_contents")
        .update({ hits: (cached.hits ?? 0) + 1 })
        .eq("id", cached.id);
      let balance: number | null = null;
      if (userId) balance = (await ensureCredits(userId)).balance;
      return json({ source: "cache", request_id: reqRow?.id, canonical_id: cached.id, kit: cached.kit, balance });
    }

    // 2) elegibilidade
    if (!userId) {
      const used = await anonUsed();
      if (!anonId || used >= ANON_FREE_USES) {
        return json({ error: "signup_required", message: "Crie sua conta gratuita para continuar — você ganha 2 créditos de IA." }, 402);
      }
    } else {
      const credits = await ensureCredits(userId);
      if (credits.balance <= 0) {
        return json({ error: "paywall", message: "Seus créditos gratuitos de IA acabaram." }, 402);
      }
    }

    const started = Date.now();
    const { data: reqRow, error: reqErr } = await admin
      .from("ai_revision_requests")
      .insert({
        user_id: userId, anon_id: anonId, prompt: assunto, disciplina, curso, instituicao,
        exam_date: examDate, nivel, cache_key: cacheKey, source: "generated",
        status: "processing", idempotency_key: idempotencyKey,
      })
      .select("id")
      .single();
    if (reqErr) {
      // corrida de duplo clique com a mesma chave de idempotência
      return json({ error: "duplicate", message: "Pedido já em processamento." }, 409);
    }
    const requestId = reqRow!.id;

    // 3) reserva do crédito
    let reservedBalance: number | null = null;
    if (userId) {
      const credits = await ensureCredits(userId);
      reservedBalance = credits.balance - 1;
      await admin.from("ai_revision_credits").update({ balance: reservedBalance }).eq("user_id", userId);
      await admin.from("ai_revision_credit_ledger").insert({
        user_id: userId, delta: -1, reason: "kit_reserve", request_id: requestId, balance_after: reservedBalance,
      });
      await admin.from("ai_revision_requests").update({ credit_reserved: true }).eq("id", requestId);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Serviço de IA indisponível." }, 500);

    try {
      const kit = await generateKit(apiKey, {
        assunto, disciplina: disciplina || undefined, curso: curso || undefined,
        instituicao: instituicao || undefined, nivel,
      });

      const { data: saved } = await admin
        .from("ai_canonical_contents")
        .upsert({
          cache_key: cacheKey,
          disciplina,
          assunto,
          subtopicos: Array.isArray(kit.subtopicos) ? kit.subtopicos.slice(0, 20) : null,
          nivel,
          model: GEN_MODEL,
          kit,
          status: "ready",
          visibility: "public_canonical",
          created_by: userId,
          hits: 1,
        }, { onConflict: "cache_key" })
        .select("id")
        .single();

      await admin
        .from("ai_revision_requests")
        .update({ status: "ready", canonical_id: saved?.id ?? null, duration_ms: Date.now() - started })
        .eq("id", requestId);

      return json({
        source: "generated",
        request_id: requestId,
        canonical_id: saved?.id ?? null,
        kit,
        balance: reservedBalance,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha na geração.";
      // devolve o crédito reservado
      if (userId && reservedBalance !== null) {
        const refunded = reservedBalance + 1;
        await admin.from("ai_revision_credits").update({ balance: refunded }).eq("user_id", userId);
        await admin.from("ai_revision_credit_ledger").insert({
          user_id: userId, delta: 1, reason: "kit_refund", request_id: requestId, balance_after: refunded,
        });
      }
      await admin
        .from("ai_revision_requests")
        .update({ status: "failed", error_message: message, credit_reserved: false })
        .eq("id", requestId);
      return json({ error: "generation_failed", message }, 500);
    }
  } catch (e) {
    console.error("ai-revision-kit", e);
    return json({ error: "Erro inesperado no Kit de Revisão." }, 500);
  }
});
