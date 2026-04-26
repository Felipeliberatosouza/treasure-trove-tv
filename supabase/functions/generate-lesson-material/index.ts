// Generate draft lesson material (simulado / top_questoes / colinha) using Lovable AI Gateway.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MaterialKind = "simulado" | "top_questoes" | "colinha" | "description";

interface RequestBody {
  kind: MaterialKind;
  title: string;
  description?: string;
  area?: string;
  transcript?: string;
  maxChars?: number;
  /**
   * "batch" (padrão): gera o conjunto inicial completo (5 questões / 10 bullets).
   * "single": gera apenas UM item adicional, evitando repetir os enviados em `existing`.
   */
  mode?: "batch" | "single";
  /**
   * Itens já preenchidos. Para simulado/top_questoes use { question, ... }; para colinha use string[].
   * A IA deve evitar duplicar conteúdo desses itens.
   */
  existing?: unknown;
}

const TOOL_BY_KIND: Record<MaterialKind, any> = {
  simulado: {
    type: "function",
    function: {
      name: "generate_simulado",
      description: "Gera 5 questões de múltipla escolha (4 alternativas) com gabarito.",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            minItems: 5,
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                question: { type: "string", description: "Enunciado, até 200 caracteres." },
                options: {
                  type: "array",
                  minItems: 4,
                  maxItems: 4,
                  items: { type: "string", description: "Alternativa, até 200 caracteres." },
                },
                correct_index: { type: "integer", minimum: 0, maximum: 3 },
              },
              required: ["question", "options", "correct_index"],
              additionalProperties: false,
            },
          },
        },
        required: ["questions"],
        additionalProperties: false,
      },
    },
  },
  top_questoes: {
    type: "function",
    function: {
      name: "generate_top_questoes",
      description: "Gera 5 perguntas abertas com respostas curtas e objetivas.",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            minItems: 5,
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                question: { type: "string", description: "Pergunta aberta, até 300 caracteres." },
                answer: { type: "string", description: "Resposta textual, até 300 caracteres." },
              },
              required: ["question", "answer"],
              additionalProperties: false,
            },
          },
        },
        required: ["questions"],
        additionalProperties: false,
      },
    },
  },
  colinha: {
    type: "function",
    function: {
      name: "generate_colinha",
      description: "Gera 10 bullets curtos para revisão rápida do conteúdo.",
      parameters: {
        type: "object",
        properties: {
          bullets: {
            type: "array",
            minItems: 10,
            maxItems: 10,
            items: { type: "string", description: "Bullet curto, até 100 caracteres." },
          },
        },
        required: ["bullets"],
        additionalProperties: false,
      },
    },
  },
  description: {
    type: "function",
    function: {
      name: "generate_description",
      description: "Gera um resumo descritivo da aula a partir da transcrição.",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Resumo claro e objetivo da aula em português brasileiro, respeitando o limite de caracteres informado.",
          },
        },
        required: ["description"],
        additionalProperties: false,
      },
    },
  },
};

const SINGLE_TOOL_BY_KIND: Record<Exclude<MaterialKind, "description">, any> = {
  simulado: {
    type: "function",
    function: {
      name: "generate_simulado_one",
      description: "Gera UMA questão de múltipla escolha (4 alternativas) com gabarito.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "Enunciado, até 200 caracteres." },
          options: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "string", description: "Alternativa, até 200 caracteres." },
          },
          correct_index: { type: "integer", minimum: 0, maximum: 3 },
        },
        required: ["question", "options", "correct_index"],
        additionalProperties: false,
      },
    },
  },
  top_questoes: {
    type: "function",
    function: {
      name: "generate_top_questoes_one",
      description: "Gera UMA pergunta aberta com resposta curta e objetiva.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "Pergunta aberta, até 300 caracteres." },
          answer: { type: "string", description: "Resposta textual, até 300 caracteres." },
        },
        required: ["question", "answer"],
        additionalProperties: false,
      },
    },
  },
  colinha: {
    type: "function",
    function: {
      name: "generate_colinha_one",
      description: "Gera UM bullet curto adicional para revisão rápida.",
      parameters: {
        type: "object",
        properties: {
          bullet: { type: "string", description: "Bullet curto, até 100 caracteres." },
        },
        required: ["bullet"],
        additionalProperties: false,
      },
    },
  },
};

const SYSTEM_PROMPTS: Record<MaterialKind, string> = {
  simulado:
    "Você é um professor brasileiro especialista. Gere 5 questões objetivas de múltipla escolha com 4 alternativas, marcando o gabarito. Use português claro, sem ambiguidade. Cada enunciado e alternativa devem ser curtos (máx. 200 caracteres).",
  top_questoes:
    "Você é um professor brasileiro especialista. Gere 5 perguntas abertas mais cobradas em provas sobre o tema, com respostas textuais objetivas (máx. 300 caracteres cada).",
  colinha:
    "Você é um professor brasileiro especialista. Gere exatamente 10 bullets curtos (máx. 100 caracteres cada) que ajudem o aluno a relembrar rapidamente os pontos-chave da aula.",
  description:
    "Você é um redator pedagógico brasileiro. Resuma a fala do professor em uma descrição clara, objetiva e atrativa para alunos, em português brasileiro. Use no máximo o limite de caracteres informado, sem ultrapassá-lo, sem usar markdown ou listas.",
};

const SINGLE_SYSTEM_PROMPTS: Record<Exclude<MaterialKind, "description">, string> = {
  simulado:
    "Você é um professor brasileiro especialista. Gere UMA questão objetiva de múltipla escolha com 4 alternativas, marcando o gabarito. NÃO repita ou parafraseie nenhuma das questões já existentes informadas.",
  top_questoes:
    "Você é um professor brasileiro especialista. Gere UMA pergunta aberta adicional sobre o tema, com resposta textual objetiva (máx. 300 caracteres). NÃO repita ou parafraseie perguntas já existentes informadas.",
  colinha:
    "Você é um professor brasileiro especialista. Gere UM bullet curto adicional (máx. 100 caracteres) que complemente os bullets já existentes. NÃO repita ou parafraseie nenhum bullet existente.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.kind || !body?.title) {
      return new Response(JSON.stringify({ error: "kind e title são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const isSingle = body.mode === "single" && body.kind !== "description";
    const tool = isSingle
      ? SINGLE_TOOL_BY_KIND[body.kind as Exclude<MaterialKind, "description">]
      : TOOL_BY_KIND[body.kind];
    if (!tool) {
      return new Response(JSON.stringify({ error: "kind inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const formatExisting = (): string => {
      const existing = body.existing;
      if (!existing) return "(nenhum item existente)";
      try {
        if (body.kind === "colinha" && Array.isArray(existing)) {
          const items = (existing as unknown[])
            .map((b) => String(b ?? "").trim())
            .filter((b) => b.length > 0);
          if (!items.length) return "(nenhum bullet existente)";
          return items.map((b, i) => `${i + 1}. ${b}`).join("\n");
        }
        if ((body.kind === "simulado" || body.kind === "top_questoes") && Array.isArray(existing)) {
          const items = (existing as Array<{ question?: string; answer?: string }>) 
            .map((q) => String(q?.question ?? "").trim())
            .filter((q) => q.length > 0);
          if (!items.length) return "(nenhuma questão existente)";
          return items.map((q, i) => `Q${i + 1}: ${q}`).join("\n");
        }
      } catch (_) {
        return "(falha ao ler itens existentes)";
      }
      return "(formato de itens existentes desconhecido)";
    };

    const userPrompt = body.kind === "description"
      ? `Aula: "${body.title}"${body.area ? ` (área: ${body.area})` : ""}\n\nLimite máximo: ${body.maxChars ?? 500} caracteres (NÃO ultrapasse).\n\nTranscrição da fala do professor:\n${body.transcript || "(transcrição vazia)"}\n\nGere uma descrição resumida da aula respeitando o limite.`
      : isSingle
        ? `Aula: "${body.title}"${body.area ? ` (área: ${body.area})` : ""}\n\nDescrição: ${body.description || "(não informada)"}\n\nItens já existentes (NÃO repita nem parafraseie):\n${formatExisting()}\n\nGere APENAS UM novo item complementar no formato solicitado.`
        : `Aula: "${body.title}"${body.area ? ` (área: ${body.area})` : ""}\n\nDescrição: ${body.description || "(não informada)"}\n\nGere o material no formato solicitado.`;

    const systemPrompt = isSingle
      ? SINGLE_SYSTEM_PROMPTS[body.kind as Exclude<MaterialKind, "description">]
      : SYSTEM_PROMPTS[body.kind];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: tool.function.name } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Falha ao gerar com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Resposta inválida da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(call.function.arguments);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lesson-material error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
