# Plano: Agente de IA "Estudar com IA" (revisão de provas sob demanda)

## Objetivo

Permitir que o aluno descreva, em linguagem natural, o conteúdo da prova
(ex.: "Vou fazer uma prova sobre Análise SWOT, gere as perguntas mais
frequentes e um vídeo explicativo com resumo") e receba, em uma conversa,
um **simulado**, um **resumo** e um **vídeo de slides narrados** (slides +
narração por IA). Tudo dentro do app Revisão Fácil atual, reaproveitando o
gerador de materiais e o Lovable AI Gateway já existentes.

## Resumo da abordagem (resposta às suas dúvidas)

- **Não é um "novo agente" do zero.** É uma nova funcionalidade do app
  atual, construída como um **agente conversacional com ferramentas
  (tool-calling)** via AI SDK + Lovable AI Gateway. O agente decide sozinho
  o que gerar a partir do pedido do aluno.
- **Vídeo = slides narrados** (a opção de baixo custo): a IA gera um roteiro
  de slides (título + bullets + texto de narração); o cliente renderiza os
  slides em HTML e toca a narração por IA (text-to-speech) sincronizada.
  **Não há geração de vídeo real (Veo)** — isso ficaria inviável no piloto.
- **Piloto barato (<100 usuários):** modelo `google/gemini-3.1-flash-lite`
  para o raciocínio do agente e geração de textos; TTS com
  `openai/gpt-4o-mini-tts`; slides em texto puro (sem gerar imagens por IA
  na fase 1). Tudo coberto por créditos do Lovable AI, sem chaves externas.

## Arquitetura

```text
Aluno (chat em /estudar-ia)
   │  (fetch SSE + Authorization: Bearer <token>)
   ▼
Edge Function "study-agent" (Deno, verify_jwt=false, valida JWT no código)
   │  AI SDK streamText + tools + stopWhen(stepCountIs(10))
   │  Provider: @ai-sdk/openai-compatible → ai.gateway.lovable.dev
   ▼
Lovable AI Gateway  ──► gemini-3.1-flash-lite (agente/textos)
                     ─► gpt-4o-mini-tts (narração, chamado pelo cliente por slide)

Ferramentas do agente (tools):
  • gerar_resumo(tópico)        → texto resumido (reaproveita prompt de "description")
  • gerar_questoes(tópico, n)   → simulado JSON (reaproveita TOOL_BY_KIND.simulado)
  • gerar_slides_narrados(tópico) → deck JSON: [{ titulo, bullets[], narracao }]
```

O cliente recebe o stream da conversa (markdown) + os resultados das
ferramentas e renderiza cada artifact inline: card de simulado (reaproveita
`SimuladoModal`), card de resumo e um **player de slides narrados**.

### Player de slides narrados (o "vídeo" de baixo custo)

1. O agente retorna `gerar_slides_narrados` com um array de slides
   `{ titulo, bullets[], narracao }` (5–8 slides).
2. O cliente pede a narração de cada slide ao endpoint TTS (Edge Function
   `study-tts`, SSE `pcm`) e toca com `AudioContext`, avançando o slide
   quando o áudio termina — efeito de vídeo narrado, sem arquivo de vídeo.
3. Slides são renderizados em HTML (texto + cores do tema) — sem custo de
   imagem. (Fase 2 opcional: gerar 1 imagem por slide com modelo de imagem.)

## Persistência e acesso

- Nova tabela `ai_study_sessions`:
  `id uuid, user_id uuid, titulo text, mensagens jsonb, criado_em, atualizado_em`.
  RLS: usuário só vê/cria suas próprias linhas (`user_id = auth.uid()`).
  GRANT `SELECT,INSERT,UPDATE` para `authenticated`; `ALL` para
  `service_role`. Migração única com `CREATE TABLE` + `GRANT` + `ENABLE RLS`
  + `CREATE POLICY`.
- Histórico: a cada turno o cliente envia as mensagens anteriores; o agente
  é stateless (envia histórico completo). Sessões salvas para retomar.
- Acesso: liberado para usuário com **assinatura ativa OU trial grátis**
  (reaproveita `useBillingStatus` / `useFreeTrial`). Sem acesso anônimo.
- Rate limit por dia: contador de sessões/turnos em `ai_study_sessions`
  (ex.: 20 turnos/dia por usuário no piloto) + retorno 429 claro.

## Componentes a criar/alterar

**Backend (Supabase Edge Functions)**
1. `supabase/functions/_shared/ai-gateway.ts` — helper
   `createLovableAiGatewayProvider(key)` com
   `@ai-sdk/openai-compatible` (`baseURL`
   `https://ai.gateway.lovable.dev/v1`, header `Lovable-API-Key`).
   Reutilizável por outras funções.
2. `supabase/functions/study-agent/index.ts` — endpoint de chat streaming.
   - Valida JWT (Bearer), exige `authenticated` (qualquer role de aluno).
   - `streamText({ model: gateway("google/gemini-3.1-flash-lite"), system,
     messages, tools, stopWhen: stepCountIs(10) })` →
     `result.toUIMessageStreamResponse()` (CORS habilitado).
   - Ferramentas chamam o gateway internamente (mesma técnica do
     `generate-lesson-material`, mas dentro do `execute` da tool).
3. `supabase/functions/study-tts/index.ts` — narração SSE de um texto
   (chunked se longo). Reaproveita o padrão do conhecimento `ai-text-to-speech`.
   Valida JWT. Retorna `text/event-stream`.

**Banco**
4. Migração: `ai_study_sessions` (com GRANT + RLS + policy).

**Frontend**
5. `src/pages/EstudarIA.tsx` — página de chat (rote `/estudar-ia`),
   protegida por assinatura/trial. Usa `useChat` (AI SDK) com
   `DefaultChatTransport` apontando para a URL da function com o token.
   Renderiza markdown (`react-markdown`) + artifacts das tools.
6. `src/components/study/NarratedSlidesPlayer.tsx` — player de slides
   sincronizados com TTS (AudioContext, avança slide a slide).
7. `src/components/study/StudySimuladoCard.tsx` — card reusando
   `SimuladoModal` para exibir as questões geradas.
8. Entrada na navegação: link "Estudar com IA" no menu do aluno e no
   StudentDashboard. Navbar dinâmico (Visitor vs Auth) recebe o item.
9. `package.json`: adicionar `ai`, `@ai-sdk/openai-compatible`,
   `react-markdown` (e `remark-gfm`).

## Controle de custo (piloto <100)

- Modelo do agente: `gemini-3.1-flash-lite` (mais barato do catálogo).
- Sem geração de imagem na fase 1 (slides em texto).
- TTS apenas sob demanda (o player pede narração ao clicar em "tocar"; não
  gera áudio de todos os slides automaticamente).
- Cache por tópico: se o mesmo tópico já foi gerado na sessão, reutiliza.
- Rate limit + gate de assinatura/trial impedem uso indevido.

## Fases de entrega

1. **Migração + helper do gateway** (fundação).
2. **Edge function `study-agent`** com a tool `gerar_resumo` primeiro
   (validar streaming end-to-end com um prompt simples).
3. **Página de chat** (`EstudarIA`) + integração com `useChat`.
4. **Tools `gerar_questoes`** + card de simulado.
5. **Tool `gerar_slides_narrados`** + `study-tts` + player de slides narrados.
6. **Gate de acesso + rate limit** + entrada no menu.
7. Testes: um fluxo real ("Análise SWOT") via Playwright, conferindo
   resumo, simulado e player de narração.

## Notas técnicas

- Edge functions usam `npm:ai` e `npm:@ai-sdk/openai-compatible` (Deno
  resolve via registro, sem build). `verify_jwt=false` com validação manual
  do JWT e checagem de role (padrão já usado pelo projeto).
- Cliente chama a function pela URL pública
  (`https://<project>.functions.supabase.co/study-agent`) com
  `Authorization: Bearer <access_token>` — não por `supabase.functions.invoke`
  (que não faz streaming).
- `openai/gpt-4o-mini-tts` exige `voice` (default `alloy`) e
  `stream_format:"sse"` + `response_format:"pcm"` para tocar em tempo real.
- Tratamento de erros do gateway: 429 (limite), 402 (créditos),
  403 (bloqueio) exibidos como toast claro — sem retry de erros terminais.
