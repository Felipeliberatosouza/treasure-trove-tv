import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const TWILIO_URL = "https://connector-gateway.lovable.dev/twilio";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface AgentConfig {
  enabled?: boolean;
  agent_name?: string;
  greeting?: string;
  handoff_customer_message?: string;
  handoff_whatsapp?: string;
  style_notes?: string;
}

const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    const { data: settingsRows } = await admin
      .from("platform_settings")
      .select("key, value")
      .in("key", ["support_agent", "contact", "twilio_config"]);
    const get = (k: string) => (settingsRows?.find((r) => r.key === k)?.value ?? {}) as Record<string, unknown>;
    const cfg = get("support_agent") as AgentConfig;
    const agentName = cfg.agent_name || "Clara";

    const loadMessages = async (id: string) => {
      const { data } = await admin
        .from("support_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", id)
        .order("created_at");
      return (data ?? []).filter((m) => m.role !== "system");
    };

    const loadConv = async () => {
      const id = clip(body.id, 64);
      const token = clip(body.token, 64);
      if (!id || !token) return null;
      const { data } = await admin
        .from("support_conversations")
        .select("*")
        .eq("id", id)
        .eq("access_token", token)
        .maybeSingle();
      return data;
    };

    // ---------- start ----------
    if (action === "start") {
      let userId: string | null = null;
      const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
      if (auth) {
        const { data } = await admin.auth.getUser(auth);
        userId = data.user?.id ?? null;
      }
      const name = clip(body.name, 120);
      const { data: conv, error } = await admin
        .from("support_conversations")
        .insert({
          user_id: userId,
          visitor_name: name || null,
          email: clip(body.email, 160) || null,
          phone: clip(body.phone, 20).replace(/\D/g, "") || null,
        })
        .select("id, access_token, status")
        .single();
      if (error) throw error;
      const firstName = name.split(" ")[0];
      let greeting = cfg.greeting || `Oi! Meu nome é ${agentName}, estou aqui para te ajudar. Como posso te ajudar hoje?`;
      if (firstName) greeting = greeting.replace(/^Oi!?/, `Oi, ${firstName}!`);
      await admin.from("support_messages").insert({ conversation_id: conv.id, role: "agent", content: greeting });
      return json({ id: conv.id, token: conv.access_token, status: conv.status, agentName, messages: await loadMessages(conv.id) });
    }

    // ---------- poll ----------
    if (action === "poll") {
      const conv = await loadConv();
      if (!conv) return json({ error: "Conversa não encontrada." }, 404);
      return json({ status: conv.status, agentName, messages: await loadMessages(conv.id) });
    }

    // ---------- admin reply ----------
    if (action === "admin_reply") {
      const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
      const { data: u } = await admin.auth.getUser(auth ?? "");
      if (!u.user) return json({ error: "Não autorizado." }, 401);
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "Não autorizado." }, 403);
      const id = clip(body.id, 64);
      const text = clip(body.text, 2000);
      if (!text) return json({ error: "Digite a mensagem." }, 400);
      await admin.from("support_messages").insert({ conversation_id: id, role: "human", content: text });
      await admin.from("support_conversations").update({ status: "human", updated_at: new Date().toISOString() }).eq("id", id);
      return json({ ok: true });
    }

    // ---------- send ----------
    if (action === "send") {
      const conv = await loadConv();
      if (!conv) return json({ error: "Conversa não encontrada." }, 404);
      const text = clip(body.text, 1500);
      if (!text) return json({ error: "Digite sua mensagem." }, 400);
      await admin.from("support_messages").insert({ conversation_id: conv.id, role: "customer", content: text });
      await admin.from("support_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conv.id);

      // Humano assumiu ou aguardando humano: a atendente não responde mais.
      if (conv.status !== "bot") {
        return json({ status: conv.status, agentName, messages: await loadMessages(conv.id) });
      }

      const { data: faqs } = await admin
        .from("support_faqs")
        .select("id, category, question, answer")
        .eq("status", "active")
        .limit(300);
      const kb = (faqs ?? []).map((f, i) => `#${i + 1} [${f.category}] P: ${f.question}\nR: ${f.answer}`).join("\n\n");
      const history = (await loadMessages(conv.id)).slice(-20);

      const system = `Você é ${agentName}, atendente da equipe da Revisão Fácil (plataforma de revisão para provas, com aulas gravadas por professores, aulas com professor virtual, resumos, simulados, colinhas, Top Questões e trabalhos em Word e slides).
REGRAS ABSOLUTAS:
- Apresente-se apenas como ${agentName}, da equipe de atendimento. Não fale sobre tecnologia, sistemas ou automação por conta própria. Se o cliente perguntar diretamente se está falando com uma pessoa ou com um robô, responda com honestidade em uma frase curta e ofereça chamar alguém da equipe.
- Escreva como no WhatsApp: mensagens curtas (1 a 3 frases), português do Brasil, tom acolhedor e natural, sem listas longas nem markdown pesado. Evite repetir saudações.
- Responda SOMENTE com base na BASE DE CONHECIMENTO abaixo. Não invente preços, prazos, políticas ou funcionalidades.
- Se a base não tiver a resposta, se o cliente pedir para falar com uma pessoa, reclamar, demonstrar insatisfação ou repetir a mesma dúvida sem ficar satisfeito, marque handoff=true.
- Quando a pergunta não estiver coberta pela base, preencha new_question com a pergunta do cliente reescrita de forma genérica e curta; senão null.
${cfg.style_notes ? `Estilo: ${cfg.style_notes}` : ""}
Nome do cliente: ${conv.visitor_name || "não informado"}.

BASE DE CONHECIMENTO:
${kb}

Responda em JSON: {"reply": string, "handoff": boolean, "reason": string|null, "new_question": string|null, "used_faq": number|null}`;

      const key = Deno.env.get("LOVABLE_API_KEY");
      let parsed: { reply?: string; handoff?: boolean; reason?: string | null; new_question?: string | null; used_faq?: number | null } = {};
      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            reasoning_effort: "low",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: system },
              ...history.map((m) => ({
                role: m.role === "customer" ? "user" : "assistant",
                content: m.content,
              })),
            ],
          }),
        });
        if (!resp.ok) {
          console.error("gateway", resp.status, await resp.text());
          parsed = { handoff: true, reason: "Falha técnica na resposta automática" };
        } else {
          const data = await resp.json();
          parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
        }
      } catch (e) {
        console.error("ai error", e);
        parsed = { handoff: true, reason: "Falha técnica na resposta automática" };
      }

      // Aprendizado contínuo: pergunta nova entra como pendente para revisão do admin.
      if (parsed.new_question) {
        const q = clip(parsed.new_question, 300);
        const { data: exists } = await admin.from("support_faqs").select("id").ilike("question", q).maybeSingle();
        if (!exists) {
          await admin.from("support_faqs").insert({ question: q, answer: "", status: "pending", source: "learned", category: "Novas perguntas" });
        }
      }
      if (typeof parsed.used_faq === "number" && faqs?.[parsed.used_faq - 1]) {
        const f = faqs[parsed.used_faq - 1] as { id: string };
        const { data: cur } = await admin.from("support_faqs").select("usage_count").eq("id", f.id).single();
        await admin.from("support_faqs").update({ usage_count: (cur?.usage_count ?? 0) + 1 }).eq("id", f.id);
      }

      const handoff = !!parsed.handoff || !!parsed.new_question;
      if (!handoff && parsed.reply) {
        await admin.from("support_messages").insert({ conversation_id: conv.id, role: "agent", content: clip(parsed.reply, 2000) });
        return json({ status: "bot", agentName, messages: await loadMessages(conv.id) });
      }

      // ---------- transferência para humano ----------
      const reason = clip(parsed.reason || (parsed.new_question ? "Pergunta sem resposta cadastrada" : "Cliente pediu atendimento humano"), 300);
      const waitMsg = cfg.handoff_customer_message || "Já estamos analisando a sua solicitação. Aguarde só um pouquinho que alguém da nossa equipe vai continuar com você.";
      await admin.from("support_messages").insert({ conversation_id: conv.id, role: "agent", content: waitMsg });
      await admin
        .from("support_conversations")
        .update({ status: "waiting_human", handoff_reason: reason, handoff_at: new Date().toISOString() })
        .eq("id", conv.id);

      const contact = get("contact");
      const twilio = get("twilio_config");
      const target = String(cfg.handoff_whatsapp || contact.whatsapp || "").replace(/\D/g, "");
      const from = String(twilio.whatsapp_from_number || "");
      const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
      const last = history.filter((m) => m.role === "customer").slice(-3).map((m) => `• ${m.content}`).join("\n");
      // WhatsApp: só conta como avisado quando o Twilio confirma a entrega.
      let waState: "delivered" | "failed" | "pending" | "skipped" = "skipped";
      if (target && from && TWILIO_API_KEY && key) {
        const to = target.startsWith("55") ? target : `55${target}`;
        const msg = `Revisão Fácil – atendimento aguardando você\nCliente: ${conv.visitor_name || "-"}\nCelular: ${conv.phone || "-"}\nE-mail: ${conv.email || "-"}\nMotivo: ${reason}\nÚltimas mensagens:\n${last}\n\nResponda pelo Painel Administrativo > Atendimento Virtual${conv.phone ? ` ou no WhatsApp https://wa.me/55${conv.phone}` : ""}.`;
        const headers = { Authorization: `Bearer ${key}`, "X-Connection-Api-Key": TWILIO_API_KEY };
        const r = await fetch(`${TWILIO_URL}/Messages.json`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: `whatsapp:+${to}`, From: `whatsapp:${from}`, Body: msg.slice(0, 1500) }),
        });
        if (!r.ok) {
          waState = "failed";
          console.error("twilio", await r.text());
        } else {
          const sid = (await r.json().catch(() => ({})))?.sid;
          waState = "pending";
          for (let i = 0; sid && i < 6; i++) {
            await new Promise((res) => setTimeout(res, 2500));
            const s = await fetch(`${TWILIO_URL}/Messages/${sid}.json`, { headers }).then((x) => x.json()).catch(() => null);
            const st = String(s?.status || "");
            if (st === "delivered" || st === "read") { waState = "delivered"; break; }
            if (st === "failed" || st === "undelivered") { waState = "failed"; console.error("twilio status", st, s?.error_code); break; }
          }
        }
      }
      const waLabel = { delivered: "entregue", failed: "não entregue", pending: "sem confirmação de entrega", skipped: "não configurado" }[waState];

      // E-mail para a equipe sempre que o WhatsApp não tiver entrega confirmada.
      let emailed = false;
      const teamEmail = String(contact.email || "").trim();
      if (waState !== "delivered" && teamEmail) {
        try {
          const site = Deno.env.get("SITE_URL") || "https://revisaofacil.com.br";
          const res = await sendTemplateEmail("support-handoff-admin", teamEmail, {
            templateData: {
              customerName: conv.visitor_name || "", customerPhone: conv.phone || "", customerEmail: conv.email || "",
              reason, lastMessages: last, whatsappStatus: waLabel, panelUrl: `${site}/admin`,
            },
            idempotencyKey: `support-handoff-${conv.id}-${Date.now()}`,
            replyTo: conv.email || undefined,
          });
          emailed = res.sent;
        } catch (e) {
          console.error("handoff email", e);
        }
      }
      const parts = [
        waState === "delivered" ? "Equipe avisada pelo WhatsApp (entrega confirmada)."
          : waState === "pending" ? "Aviso pelo WhatsApp enviado, mas sem confirmação de entrega."
          : waState === "failed" ? "O aviso pelo WhatsApp não foi entregue (verifique o número de envio em Verificação Celular)."
          : "Aviso pelo WhatsApp não configurado.",
      ];
      if (waState !== "delivered") parts.push(emailed ? `Equipe avisada por e-mail (${teamEmail}).` : "Não foi possível avisar por e-mail (confira o e-mail em Dados e Contatos).");
      await admin.from("support_messages").insert({ conversation_id: conv.id, role: "system", content: parts.join(" ") });
      return json({ status: "waiting_human", agentName, messages: await loadMessages(conv.id) });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Não foi possível continuar agora. Tente novamente." }, 500);
  }
});
