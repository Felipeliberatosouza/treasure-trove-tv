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

const GEN_MODEL = "openai/gpt-6-astra";
const TEMPLATE_VERSION = "v5";
const PROMPT_VERSION = "v6";
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

type AgeGroup = "criancas_0_9" | "pre_adolescentes_10_13" | "adolescentes_14_17" | "jovens_18_25" | "adultos_26_45" | "adultos_46_mais";

const AGE_GUIDANCE: Record<AgeGroup, string> = {
  criancas_0_9: "crianças de 0 a 9 anos: frases muito curtas, palavras simples, repetição positiva, exemplos concretos, ilustrações lúdicas e apenas um passo visual por vez",
  pre_adolescentes_10_13: "pré-adolescentes de 10 a 13 anos: linguagem simples sem infantilização, desafios curtos, exemplos escolares e lousa guiada",
  adolescentes_14_17: "adolescentes de 14 a 17 anos: linguagem direta, exemplos de estudo e cotidiano, dicas de prova e raciocínio progressivo",
  jovens_18_25: "jovens universitários de 18 a 25 anos: linguagem informal universitária, termos técnicos explicados, exemplos práticos e foco em prova",
  adultos_26_45: "adultos de 26 a 45 anos: linguagem objetiva, aplicações profissionais e cotidianas e poucos elementos lúdicos",
  adultos_46_mais: "adultos maduros acima de 46 anos: ritmo calmo, alta legibilidade, frases claras, poucos elementos simultâneos e exemplos familiares",
};

function detectAgeGroup(value: string): { group: AgeGroup; confidence: number } {
  const text = normalize(value);
  const ageMatch = text.match(/\b(\d{1,2})\s*anos?\b/) || text.match(/(?:idade|para|tem)\s*(?:de\s*)?(\d{1,2})/);
  const age = ageMatch ? Number(ageMatch[1]) : null;
  if (age !== null && age >= 0 && age <= 120) {
    if (age <= 9) return { group: "criancas_0_9", confidence: 0.99 };
    if (age <= 13) return { group: "pre_adolescentes_10_13", confidence: 0.99 };
    if (age <= 17) return { group: "adolescentes_14_17", confidence: 0.99 };
    if (age <= 25) return { group: "jovens_18_25", confidence: 0.99 };
    if (age <= 45) return { group: "adultos_26_45", confidence: 0.99 };
    return { group: "adultos_46_mais", confidence: 0.99 };
  }
  if (/crianca|infantil|educacao infantil|alfabetizacao/.test(text)) return { group: "criancas_0_9", confidence: 0.9 };
  if (/pre adolescente|fundamental ii|sexto ano|setimo ano/.test(text)) return { group: "pre_adolescentes_10_13", confidence: 0.86 };
  if (/adolescente|ensino medio|vestibular|enem/.test(text)) return { group: "adolescentes_14_17", confidence: 0.84 };
  if (/adulto maduro|terceira idade|idoso|acima de 46/.test(text)) return { group: "adultos_46_mais", confidence: 0.86 };
  if (/adulto|profissional|trabalho/.test(text)) return { group: "adultos_26_45", confidence: 0.72 };
  return { group: "jovens_18_25", confidence: 0.5 };
}

function buildCacheKey(input: { disciplina?: string; assunto: string; nivel: string; faixaEtaria: AgeGroup }) {
  return [
    normalize(input.disciplina || "geral"),
    normalize(input.assunto),
    "pt-br",
    normalize(input.nivel || "rapido"),
    input.faixaEtaria,
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
          description: "Seções do resumo (3 a 4 seções objetivas).",
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
        colinha: { type: "array", items: { type: "string" }, description: "6 a 8 bullets curtos." },
        simulado: {
          type: "array",
          description: "4 questões de múltipla escolha.",
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
          description: "Exatamente 3 questões abertas com gabarito comentado.",
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
          description: "Exatamente 7 slides: introdução, 2 slides de conceitos, 3 slides de Top Questões e encerramento.",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
              narracao: { type: "string" },
              imagem_prompt: { type: "string", description: "Descrição objetiva da imagem didática que representa este slide, sem texto escrito." },
              frase_didatica: { type: "string", description: "Frase curta exibida no slide para reforçar a explicação." },
              palavras_chave: { type: "array", description: "Uma a três palavras importantes, cada uma ligada a uma frase-âncora literal da narração.", items: { type: "object", properties: { termo: { type: "string" }, ancora: { type: "string" } }, required: ["termo", "ancora"] } },
              modo_visual: { type: "string", description: "Use avatar na introdução/encerramento, lousa quando houver raciocínio passo a passo e conteudo nos demais." },
              lousa_passos: { type: "array", description: "Passos seguros para a lousa virtual. Vazio quando não for útil.", items: { type: "object", properties: { tipo: { type: "string" }, conteudo: { type: "string" }, ancora: { type: "string" }, destaque: { type: "string" } }, required: ["tipo", "conteudo", "ancora", "destaque"] } },
            },
            required: ["titulo", "bullets", "narracao", "imagem_prompt", "frase_didatica", "palavras_chave", "modo_visual", "lousa_passos"],
          },
        },
        areas: {
          type: "array",
          items: { type: "string" },
          description: "Áreas de curso às quais este conteúdo pertence. Use SOMENTE nomes exatos da lista de áreas cadastradas informada no pedido. Pode indicar mais de uma área quando o conteúdo for relevante para várias.",
        },
      },
      required: ["titulo", "assunto", "resumo", "conceitos_chave", "colinha", "simulado", "top_questoes", "slides", "areas"],
    },
  },
};

async function generateKit(apiKey: string, params: {
  assunto: string;
  disciplina?: string;
  curso?: string;
  instituicao?: string;
  nivel: string;
  areasDisponiveis: string[];
  faixaEtaria: AgeGroup;
  confiancaFaixaEtaria: number;
}) {
  const system = `Você é um professor virtual brasileiro da Revisão Fácil que cria aulas didáticas para diferentes idades.
Escreva em português brasileiro e adapte rigorosamente toda a aula para ${AGE_GUIDANCE[params.faixaEtaria]}.
Não invente fontes nem dados específicos de instituições.

REGRAS DE LINGUAGEM (obrigatórias):
- Use linguagem neutra em gênero: "se prepare para a prova" em vez de "esteja preparado".
- Nunca use palavras de baixo calão, alusões sexuais, conteúdo racista, preconceituoso ou temas polêmicos (futebol, religião, política).
- Nunca cite nomes de pessoas físicas ou jurídicas reais.

PADRÃO DA NARRAÇÃO DOS SLIDES (obrigatório):
- Slide 1 (introdução): narração no estilo "Olá, pessoal! Sejam bem-vindos a este rápido resumo essencial para a sua prova de [assunto]. Em poucos minutos vamos revisar os pontos-chave que você precisa dominar e arrebentar na prova! Vamos lá? Cola aqui que você vai bem!". Deixe claro que é uma revisão com os pontos essenciais para a prova.
- Slides do meio: conceitos-chave e conteúdos de prova, sempre com exemplos reais do dia a dia (não só teoria) e com frases descontraídas espalhadas, como "Isso tem alta chance de cair na sua prova...", "Presta atenção aqui, dica de prova!", "Atenção a esse ponto, cai sempre em provas...".
- TOP QUESTÕES (obrigatório): antes do slide de encerramento, inclua slides dedicados às Top Questões. Cada Top Questão gerada no campo top_questoes deve aparecer na narração de um desses slides, lida por completo e seguida da resolução comentada passo a passo (raciocínio, pegadinhas e o porquê da resposta). Os bullets desses slides trazem o enunciado resumido e os passos da resolução.
- Último slide (encerramento): reforce os pontos mais importantes do conteúdo, peça para o aluno deixar a dúvida (um professor responde), compartilhar a revisão com os colegas e avaliar o vídeo, e sugira fazer o simulado que está disponibilizado aqui e marcar uma aula com um professor. Nunca sugira "ver as Top Questões resolvidas" no encerramento. Termine com "Boa prova!".

RECURSOS DIDÁTICOS (obrigatórios):
- Em cada slide selecione somente 1 a 3 palavras_chave realmente importantes. Cada ancora deve copiar literalmente um pequeno trecho da narração onde o termo é explicado.
- Escreva uma frase_didatica curta que contenha as palavras_chave e possa aparecer na tela durante a fala.
- Use modo_visual "lousa" quando houver conta, fórmula, sequência, comparação ou raciocínio passo a passo; use "avatar" na introdução e encerramento; use "conteudo" nos demais.
- Na lousa, use somente os tipos texto, operacao, seta, linha, circulo ou desenho. Cada passo deve ter conteúdo curto, uma ancora literal da narração e destaque. Não gere HTML, SVG ou código.
- A imagem_prompt deve refletir o assunto e a faixa etária. Para crianças, use ilustração educativa amigável e lúdica; para adultos, visual didático mais sóbrio.
- Não use lousa apenas como decoração: o que surge na lousa deve acompanhar a explicação falada.`;
  const user = `Monte um Kit de Revisão completo.
Assunto informado pelo aluno: ${params.assunto}
Disciplina: ${params.disciplina || "não informada"}
Curso: ${params.curso || "não informado"}
Instituição: ${params.instituicao || "não informada"}
Profundidade: ${params.nivel === "aprofundado" ? "aprofundada" : "revisão rápida"}
Público detectado: ${AGE_GUIDANCE[params.faixaEtaria]} (confiança ${Math.round(params.confiancaFaixaEtaria * 100)}%).
  Gere exatamente 7 slides, com narração de no máximo 450 caracteres por slide: 1 introdução, 2 slides de conceitos-chave com exemplos do dia a dia e dicas de prova, 3 slides de Top Questões (uma questão por slide, com enunciado e resolução comentada) e 1 encerramento.
Em cada slide, escreva uma narração fluida em português brasileiro informal e uma direção de imagem didática diretamente relacionada ao tópico (no primeiro e no último slide a imagem é apenas de ambiente, sem conteúdo escrito).

CLASSIFICAÇÃO POR ÁREA (obrigatória): no campo "areas", escolha entre 1 e 3 áreas desta lista de áreas de curso cadastradas na plataforma, copiando o nome EXATAMENTE como aparece:
${params.areasDisponiveis.map((a) => `- ${a}`).join("\n") || "- (nenhuma área cadastrada)"}
Se o conteúdo for relevante para mais de uma área, indique todas as que fizerem sentido. Nunca invente nomes de área fora da lista.`;
  // Chamada direta (sem SDK de streaming): o parsing de stream consumia CPU
  // suficiente para estourar o limite da edge function ("CPU Time exceeded").
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GEN_MODEL,
      stream: false,
      // Raciocínio mínimo: reduz muito o tempo de entrega sem perder qualidade didática.
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `${user}\n\nResponda somente com um objeto JSON válido que siga este esquema: ${JSON.stringify(KIT_TOOL.function.parameters)}.`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("ai-revision-kit gateway error", res.status, detail.slice(0, 500));
    if (res.status === 429) throw new Error("Muitos pedidos agora. Aguarde um instante e tente novamente.");
    throw new Error("Não foi possível gerar o material agora. Tente novamente em instantes.");
  }
  const payload = await res.json();
  const text: string = payload?.choices?.[0]?.message?.content ?? "";
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!clean) throw new Error("A IA não retornou o Kit de Revisão.");
  try { return JSON.parse(clean); } catch { throw new Error("A IA retornou um material inválido. Tente novamente."); }
}

async function handleRequest(req: Request, body: any): Promise<Response> {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {

    const action = body.action === "status" || body.action === "cancel" ? body.action : "generate";
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
    const cursoBase = String(body.curso || "").trim().slice(0, 120);
    const serie = String(body.serie || "").replace(/\D/g, "").slice(0, 3);
    const curso = [cursoBase, serie ? `${serie}ª série/ano` : ""].filter(Boolean).join(" - ") || null;
    const instituicao = String(body.instituicao || "").trim().slice(0, 120) || null;
    const examDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.exam_date || "")) ? body.exam_date : null;
    const nivel = body.nivel === "aprofundado" ? "aprofundado" : "rapido";
    const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key.slice(0, 80) : null;

    const ageDetection = detectAgeGroup([assunto, disciplina, curso].filter(Boolean).join(" "));
    const faixaEtaria = ageDetection.group;
    const confiancaFaixaEtaria = ageDetection.confidence;
    const cacheKey = buildCacheKey({ disciplina: disciplina || undefined, assunto, nivel, faixaEtaria });

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
    let { data: cached } = await admin
      .from("ai_canonical_contents")
      .select("id, kit, status, visibility, hits")
      .eq("cache_key", cacheKey)
      .eq("visibility", "public_canonical")
      .eq("status", "ready")
      .maybeSingle();

    // 1b) busca aproximada no acervo: mesmo assunto já produzido (com ou sem a mesma disciplina)
    if (!cached) {
      const alvo = normalize(assunto);
      const { data: candidatos } = await admin
        .from("ai_canonical_contents")
        .select("id, kit, assunto, disciplina, nivel, faixa_etaria, hits")
        .eq("visibility", "public_canonical")
        .eq("status", "ready")
        .eq("faixa_etaria", faixaEtaria)
        .ilike("assunto", `%${assunto.slice(0, 60)}%`)
        .order("hits", { ascending: false })
        .limit(10);
      const escolhido = (candidatos ?? []).find((c: any) => {
        const na = normalize(String(c.assunto || ""));
        if (!na) return false;
        const mesmoAssunto = na === alvo || na.includes(alvo) || alvo.includes(na);
        if (!mesmoAssunto) return false;
        if (disciplina && c.disciplina) return normalize(String(c.disciplina)) === normalize(disciplina);
        return true;
      });
      if (escolhido) cached = escolhido as typeof cached;
    }


    if (cached) {
      const { data: reqRow } = await admin
        .from("ai_revision_requests")
        .insert({
          user_id: userId, anon_id: anonId, prompt: assunto, disciplina, curso, instituicao,
          exam_date: examDate, nivel, cache_key: cacheKey, canonical_id: cached.id,
          faixa_etaria: faixaEtaria, confianca_faixa_etaria: confiancaFaixaEtaria,
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
    let planUnlimited = false;
    if (!userId) {
      const used = await anonUsed();
      if (!anonId || used >= ANON_FREE_USES) {
        return json({ error: "signup_required", message: "Crie sua conta gratuita para continuar — você ganha 2 créditos de IA." }, 402);
      }
    } else {
      await ensureCredits(userId);
      // Créditos de IA do plano assinado (ilimitado ou cota mensal inclusa).
      const { data: planClaim } = await admin.rpc("claim_plan_ai_credits", { _user_id: userId });
      planUnlimited = Boolean((planClaim as { unlimited?: boolean } | null)?.unlimited);
      if (!planUnlimited) {
        const credits = await ensureCredits(userId);
        if (credits.balance <= 0) {
          return json({ error: "paywall", message: "Seus Créditos de IA acabaram." }, 402);
        }
      }
    }

    const started = Date.now();
    const { data: reqRow, error: reqErr } = await admin
      .from("ai_revision_requests")
      .insert({
        user_id: userId, anon_id: anonId, prompt: assunto, disciplina, curso, instituicao,
        exam_date: examDate, nivel, cache_key: cacheKey, source: "generated",
        faixa_etaria: faixaEtaria, confianca_faixa_etaria: confiancaFaixaEtaria,
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
    if (userId && !planUnlimited) {
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
      // Áreas de curso cadastradas no painel administrativo — base da classificação automática.
      const { data: areaRows } = await admin
        .from("course_areas")
        .select("name")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      const areaNames: string[] = (areaRows ?? []).map((a: { name: string }) => a.name).filter(Boolean);

      const kit = await generateKit(apiKey, {
        assunto, disciplina: disciplina || undefined, curso: curso || undefined,
        instituicao: instituicao || undefined, nivel, areasDisponiveis: areaNames,
        faixaEtaria, confiancaFaixaEtaria,
      });
      kit.faixa_etaria = faixaEtaria;
      kit.confianca_faixa_etaria = confiancaFaixaEtaria;

      // Normaliza o que a IA devolveu contra os nomes reais das áreas cadastradas.
      const suggested: string[] = Array.isArray(kit.areas) ? kit.areas.map((a: unknown) => String(a)) : [];
      const matched = new Set<string>();
      for (const s of suggested) {
        const ns = normalize(s);
        const hit = areaNames.find((n) => {
          const nn = normalize(n);
          return nn === ns || nn.includes(ns) || ns.includes(nn);
        });
        if (hit) matched.add(hit);
      }
      // Reforço: cruza também disciplina e curso informados pelo aluno.
      for (const extra of [disciplina, curso]) {
        if (!extra) continue;
        const ne = normalize(extra);
        const hit = areaNames.find((n) => {
          const nn = normalize(n);
          return nn === ne || nn.includes(ne) || ne.includes(nn);
        });
        if (hit) matched.add(hit);
      }
      const areas = Array.from(matched).slice(0, 5);

      const { data: saved } = await admin
        .from("ai_canonical_contents")
        .upsert({
          cache_key: cacheKey,
          disciplina,
          assunto,
          areas,
          subtopicos: Array.isArray(kit.subtopicos) ? kit.subtopicos.slice(0, 20) : null,
          nivel,
          faixa_etaria: faixaEtaria,
          confianca_faixa_etaria: confiancaFaixaEtaria,
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
}

// Geração pode levar vários minutos: enviamos "pings" periódicos para o
// proxy não encerrar a conexão por inatividade (idle timeout de 150s).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  if (body?.action === "status") return await handleRequest(req, body);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let done = false;
      const ping = setInterval(() => {
        if (done) return;
        try { controller.enqueue(encoder.encode(`{"type":"ping"}\n`)); } catch { /* ignore */ }
      }, 10_000);

      (async () => {
        let payload: unknown;
        let status = 200;
        try {
          const res = await handleRequest(req, body);
          status = res.status;
          payload = await res.json().catch(() => ({ error: "Resposta inválida do servidor." }));
        } catch (e) {
          console.error("ai-revision-kit stream", e);
          status = 500;
          payload = { error: "Erro inesperado no Kit de Revisão." };
        }
        done = true;
        clearInterval(ping);
        try {
          controller.enqueue(encoder.encode(JSON.stringify({ type: "result", status, payload }) + "\n"));
          controller.close();
        } catch { /* ignore */ }
      })();
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
});

