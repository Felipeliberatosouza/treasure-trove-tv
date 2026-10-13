import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const CHUNK_PAGES = 4;

async function askAi(pdfB64: string, gabarito: string, key: string): Promise<any[]> {
  const prompt = `Você recebe páginas de uma prova oficial brasileira. Transcreva FIELMENTE cada questão objetiva completa presente nestas páginas, sem inventar nem resumir.
Ignore capas, instruções e questões cortadas no início/fim das páginas (incompletas).
Responda somente JSON: {"questions":[{"number":int,"subject":string|null,"statement":string,"options":[{"letter":"A","text":string}],"correct":string|null}]}
"subject": disciplina provável (ex.: "Direito Civil", "Matemática").
"correct": use o gabarito abaixo se informado; caso contrário null.
Gabarito informado: ${gabarito || "(nenhum)"}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      input: [{ role: "user", content: [
        { type: "input_text", text: prompt },
        { type: "input_file", filename: "prova.pdf", file_data: `data:application/pdf;base64,${pdfB64}` },
      ] }],
    }),
  });
  if (!res.ok || !res.body) throw new Error(`IA ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop() || "";
    for (const l of lines) {
      if (!l.startsWith("data:")) continue;
      const d = l.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try { const ev = JSON.parse(d); if (ev.type === "response.output_text.delta") out += ev.delta; } catch { /* ignore */ }
    }
  }
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) return [];
  return JSON.parse(m[0]).questions || [];
}

function toB64(bytes: Uint8Array) {
  let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function isSafePublicUrl(raw: string) {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "metadata.google.internal") return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(h)) return false;
  if (h.includes(":") && (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:"))) return false;
  return true;
}

async function runChunk(db: any, examId: string, pdfUrl: string, gabarito: string, key: string, start: number) {
  if (!isSafePublicUrl(pdfUrl)) throw new Error("Link do PDF não permitido. Use um endereço público.");
  const r = await fetch(pdfUrl, { redirect: "manual" });
  if (r.status >= 300 && r.status < 400) throw new Error("O link do PDF redireciona para outro endereço. Use o link direto do arquivo.");
  if (!r.ok) throw new Error("Não foi possível baixar o PDF (verifique o link).");
  if (Number(r.headers.get("content-length") || 0) > 60 * 1024 * 1024) throw new Error("PDF muito grande (máximo 60 MB).");
  const src = await PDFDocument.load(new Uint8Array(await r.arrayBuffer()), { ignoreEncryption: true });
  const total = src.getPageCount();
  const end = Math.min(total, start + CHUNK_PAGES);
  const from = Math.max(0, start - 1); // 1 página de sobreposição
  const doc = await PDFDocument.create();
  (await doc.copyPages(src, Array.from({ length: end - from }, (_, i) => from + i))).forEach((p) => doc.addPage(p));
  const qs = await askAi(toB64(await doc.save()), gabarito, key);
  const rows = Array.from(new Map(qs.filter((q) => q.number && q.statement && q.options?.length).map((q) => [Number(q.number), {
    exam_id: examId, number: Number(q.number), subject: q.subject || null, statement: String(q.statement),
    options: q.options.map((o: any) => ({ letter: String(o.letter).toUpperCase(), text: String(o.text) })),
    correct: q.correct ? String(q.correct).toUpperCase().slice(0, 1) : null,
  }])).values());
  if (rows.length) {
    const { error } = await db.from("real_exam_questions").upsert(rows, { onConflict: "exam_id,number" });
    if (error) throw new Error(error.message);
  }
  const { count } = await db.from("real_exam_questions").select("id", { count: "exact", head: true }).eq("exam_id", examId);
  const done = end >= total;
  await db.from("real_exams").update({
    import_status: done ? "concluido" : "processando",
    import_message: done ? `${count ?? 0} questões importadas. Revise antes de mostrar aos alunos.` : `Páginas ${end} de ${total} lidas · ${count ?? 0} questões salvas`,
  }).eq("id", examId);
  return { next: done ? null : end, total, saved: count ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: u } = await db.auth.getUser(token);
  if (!u?.user) return json({ ok: false, error: "Faça login." }, 401);
  const { data: isAdmin } = await db.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  if (!isAdmin) return json({ ok: false, error: "Apenas administradores." }, 403);

  const body = await req.json().catch(() => ({}));
  const examId = String(body.exam_id || "");
  const gabarito = String(body.gabarito || "").slice(0, 5000);
  const { data: exam } = await db.from("real_exams").select("id, pdf_url").eq("id", examId).maybeSingle();
  const pdfUrl = String(body.pdf_url || exam?.pdf_url || "");
  if (!exam || !/^https?:\/\/.+/i.test(pdfUrl)) return json({ ok: false, error: "Informe a prova e o link do PDF." }, 400);
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return json({ ok: false, error: "IA não configurada." }, 500);

  const start = Math.max(0, Number(body.start) || 0);
  if (start === 0) await db.from("real_exams").update({ import_status: "processando", import_message: "Lendo o PDF…", pdf_url: pdfUrl }).eq("id", examId);
  try {
    return json({ ok: true, ...(await runChunk(db, examId, pdfUrl, gabarito, key, start)) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha na importação.";
    await db.from("real_exams").update({ import_status: "erro", import_message: msg }).eq("id", examId);
    return json({ ok: false, error: msg });
  }
});
