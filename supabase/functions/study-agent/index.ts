// "Estudar com IA" — agente conversacional que gera resumo, simulado e slides
// narrados a partir do pedido do aluno. Streaming via AI SDK + Lovable AI Gateway.
import { streamText, tool, stepCountIs, convertToModelMessages } from "npm:ai";
import { z } from "npm:zod";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createLovableAiGatewayProvider, getLovableAiGatewayRunId, getLovableAiGatewayResponseHeaders } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AGENT_MODEL = "google/gemini-3.7-flash";
const GEN_MODEL = "google/gemini-3.1-flash-lite"; // modelo barato para geração focada das ferramentas

const SYSTEM_PROMPT = `Você é o "Estudar com IA" da plataforma Revisão Fácil, um assistente de revisão para provas de disciplinas de graduação.
Você conversa em português brasileiro, de forma clara e encorajadora.

Quando o aluno pedir revisão de um conteúdo de prova, use as ferramentas disponíveis para produzir os materiais:
- gerar_resumo: quando pedir um resumo/explicação da matéria.
- gerar_questoes: quando pedir questões/perguntas frequentes/simulado.
- gerar_slides_narrados: quando pedir um "vídeo explicativo" ou aula narrada — você gera o roteiro de slides que será narrado por IA.

Regras:
- Sempre confirme o tema com o aluno se estiver ambíguo antes de gerar.
- Gere os materiais em português brasileiro.
- Apresente cada resultado de forma amigável, explicando o que foi gerado.
- Não invente que já gerou; chame a ferramenta para de fato produzir o conteúdo.
- Se o pedido envolver mais de um material, chame várias ferramentas na mesma resposta.`;

// ---- Geração focada (reutiliza a técnica do generate-lesson-material) ----
type ToolDef = { type: "function"; function: { name: string; description: string; parameters: any } };

async function gatewayFunctionCall(
  apiKey: string,
  system: string,
  userPrompt: string,
  toolDef: ToolDef,
): Promise<any> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEN_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      tools: [toolDef],
      tool_choice: { type: "function", function: { name: toolDef.function.name } },
    }),
  });
  if (resp.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
  if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    console.error("gateway gen error", resp.status, t);
    throw new Error("Falha ao gerar com IA");
  }
  const data = await resp.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("Resposta inválida da IA");
  return JSON.parse(call.function.arguments);
}

const RESUMO_TOOL: ToolDef = {
  type: "function",
  function: {
    name: "gerar_resumo",
    description: "Gera um resumo didático da matéria.",
    parameters: {
      type: "object",
      properties: { resumo: { type: "string", description: "Resumo claro e objetivo em português, até 1200 caracteres." } },
      required: ["resumo"],
      additionalProperties: false,
    },
  },
};

const QUESTOES_TOOL: ToolDef = {
  type: "function",
  function: {
    name: "gerar_questoes",
    description: "Gera 5 questões de múltipla escolha com gabarito.",
    parameters: {
      type: "object",
      properties: {
        questoes: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              question: { type: "string", description: "Enunciado, até 200 caracteres." },
              options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string", description: "Alternativa, até 200 caracteres." } },
              correct_index: { type: "integer", minimum: 0, maximum: 3 },
            },
            required: ["question", "options", "correct_index"],
            additionalProperties: false,
          },
        },
      },
      required: ["questoes"],
      additionalProperties: false,
    },
  },
};

const SLIDES_TOOL: ToolDef = {
  type: "function",
  function: {
    name: "gerar_slides_narrados",
    description: "Gera um roteiro de 6 slides para uma aula narrada por IA.",
    parameters: {
      type: "object",
      properties: {
        slides: {
          type: "array",
          minItems: 6,
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              titulo: { type: "string", description: "Título curto do slide, até 80 caracteres." },
              bullets: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", description: "Bullet curto, até 120 caracteres." } },
              narracao: { type: "string", description: "Texto da narração em português, falado, até 400 caracteres." },
            },
            required: ["titulo", "bullets", "narracao"],
            additionalProperties: false,
          },
        },
      },
      required: ["slides"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // ---- Auth ----
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: ud } = await userClient.auth.getUser();
    const uid = ud?.user?.id;
    if (!uid) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const uiMessages: any[] = Array.isArray(body?.messages) ? body.messages : [];
    if (uiMessages.length === 0) {
      return new Response(JSON.stringify({ error: "Mensagem vazia" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const messages = convertToModelMessages(uiMessages);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const initialRunId = getLovableAiGatewayRunId(req);
    const gateway = createLovableAiGatewayProvider(apiKey, initialRunId);

    // ---- Ferramentas do agente ----
    const tools = {
      gerar_resumo: tool({
        description: "Gera um resumo didático da matéria solicitada pelo aluno.",
        inputSchema: z.object({ topico: z.string().describe("Tema/conteúdo da prova") }),
        execute: async ({ topico }: { topico: string }) => {
          const out = await gatewayFunctionCall(
            apiKey,
            "Você é um professor brasileiro. Gere um resumo didático, claro e objetivo da matéria, em português, até 1200 caracteres, sem markdown.",
            `Tema: "${topico}". Gere o resumo.`,
            RESUMO_TOOL,
          );
          return { tipo: "resumo", topico, resumo: String(out?.resumo ?? "").slice(0, 1200) };
        },
      }),
      gerar_questoes: tool({
        description: "Gera 5 questões de múltipla escolha (4 alternativas) com gabarito, sobre o tema da prova.",
        inputSchema: z.object({ topico: z.string().describe("Tema/conteúdo da prova"), quantidade: z.number().optional().describe("Quantidade de questões (padrão 5)") }),
        execute: async ({ topico }: { topico: string; quantidade?: number }) => {
          const out = await gatewayFunctionCall(
            apiKey,
            "Você é um professor brasileiro especialista. Gere 5 questões objetivas de múltipla escolha com 4 alternativas, marcando o gabarito. Use português claro, sem ambiguidade. Cada enunciado e alternativa até 200 caracteres.",
            `Tema: "${topico}". Gere as 5 questões mais frequentes em provas sobre o tema.`,
            QUESTOES_TOOL,
          );
          const questoes = (Array.isArray(out?.questoes) ? out.questoes : []).slice(0, 5).map((q: any) => ({
            question: String(q?.question ?? "").slice(0, 200),
            options: (Array.isArray(q?.options) ? q.options : []).slice(0, 4).map((o: any) => String(o ?? "").slice(0, 200)),
            correct_index: Math.max(0, Math.min(3, Number(q?.correct_index ?? 0))),
          }));
          return { tipo: "simulado", topico, questoes };
        },
      }),
      gerar_slides_narrados: tool({
        description: "Gera um roteiro de 6 slides para uma aula narrada por IA (vídeo explicativo) sobre o tema.",
        inputSchema: z.object({ topico: z.string().describe("Tema/conteúdo da prova") }),
        execute: async ({ topico }: { topico: string }) => {
          const out = await gatewayFunctionCall(
            apiKey,
            "Você é um professor brasileiro. Gere um roteiro de 6 slides para uma aula narrada. Cada slide tem título curto, 2 a 4 bullets e um texto de narração falado em português (até 400 caracteres).",
            `Tema: "${topico}". Gere o roteiro de 6 slides cobrindo os pontos essenciais da matéria de forma didática.`,
            SLIDES_TOOL,
          );
          const slides = (Array.isArray(out?.slides) ? out.slides : []).slice(0, 8).map((s: any) => ({
            titulo: String(s?.titulo ?? "").slice(0, 80),
            bullets: (Array.isArray(s?.bullets) ? s.bullets : []).slice(0, 4).map((b: any) => String(b ?? "").slice(0, 120)),
            narracao: String(s?.narracao ?? "").slice(0, 500),
          }));
          return { tipo: "slides_narrados", topico, slides };
        },
      }),
    };

    const result = streamText({
      model: gateway(AGENT_MODEL),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: stepCountIs(10),
    });

    const response = result.toUIMessageStreamResponse({
      headers: getLovableAiGatewayResponseHeaders(undefined, {
        ...corsHeaders,
        ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
      }),
    });
    return response;
  } catch (e) {
    console.error("study-agent error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("Limite") ? 429 : msg.includes("Créditos") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
