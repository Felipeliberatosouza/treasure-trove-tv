// Triagem automática dos reportes da versão beta: separa problema técnico de
// decisão de negócio e prepara a instrução pronta para corrigir no Lovable.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `Você faz a triagem de reportes de erro da plataforma educacional Revisão Fácil (site em português).
Classifique cada reporte:
- "tecnico": falha de funcionamento que um programador corrige sem precisar de decisão do dono (tela quebrada, botão não funciona, erro de carregamento, loop, layout cortado).
- "negocio": exige decisão do dono (preços, regras de créditos, conteúdo, políticas, prioridade de funcionalidade, texto institucional, mudança de comportamento desejado).
- "descartar": spam, teste, sem informação útil ou ruído de navegador/extensão.
Responda SOMENTE JSON: {"categoria":"tecnico|negocio|descartar","resumo":"1 frase simples","decisao":"pergunta objetiva ao dono (só se negocio, senão vazio)","instrucao":"instrução completa em português para o Lovable corrigir, citando página, mensagem de erro e comportamento esperado"}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: ud } = await user.auth.getUser();
    if (!ud?.user) return json({ error: "Não autenticado" });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: ud.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Acesso restrito ao administrador" });

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "IA não configurada" });

    const { data: rows } = await admin.from("beta_bug_reports")
      .select("id, origin, page_url, description, error_message, stack_trace, error_kind, occurrences")
      .is("triaged_at", null).eq("status", "pendente").order("created_at", { ascending: false }).limit(20);

    let done = 0;
    for (const r of rows ?? []) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: JSON.stringify({
              origem: r.origin, pagina: r.page_url, relato: r.description, erro: r.error_message,
              tipo: r.error_kind, ocorrencias: r.occurrences, rastreamento: (r.stack_trace ?? "").slice(0, 1500),
            }) },
          ],
        }),
      });
      if (resp.status === 429 || resp.status === 402) {
        return json({ done, error: resp.status === 429 ? "Limite da IA atingido, tente em instantes." : "Créditos de IA esgotados no workspace." });
      }
      if (!resp.ok) { console.error("triage ai", resp.status, await resp.text()); continue; }
      const data = await resp.json();
      let out: any = {};
      try { out = JSON.parse(data.choices?.[0]?.message?.content ?? "{}"); } catch { continue; }
      const cat = ["tecnico", "negocio", "descartar"].includes(out.categoria) ? out.categoria : "tecnico";
      const instr = `Corrija o problema reportado na plataforma Revisão Fácil.\n\n${String(out.instrucao ?? "")}\n\nDados do reporte (id ${r.id}):\nPágina: ${r.page_url ?? "—"}\nRelato: ${r.description ?? "—"}\nErro: ${r.error_message ?? "—"}\n\nTeste a correção antes de dizer que terminou.`;
      await admin.from("beta_bug_reports").update({
        triage_category: cat,
        triage_summary: String(out.resumo ?? "").slice(0, 400),
        triage_decision: cat === "negocio" ? String(out.decisao ?? "").slice(0, 600) : null,
        lovable_prompt: cat === "descartar" ? null : instr.slice(0, 4000),
        triaged_at: new Date().toISOString(),
        ...(cat === "descartar" ? { status: "descartado" } : {}),
      }).eq("id", r.id);
      done++;
    }
    return json({ done });
  } catch (e) {
    console.error(e);
    return json({ error: "Falha na triagem" });
  }
});
