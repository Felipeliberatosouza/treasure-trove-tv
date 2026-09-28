import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json" } });

const SUBJECTS: Record<string, string> = {
  "ciencias-humanas": "Ciências Humanas",
  "ciencias-natureza": "Ciências da Natureza",
  "linguagens": "Linguagens",
  "matematica": "Matemática",
};

// Importa questões oficiais do ENEM (fonte aberta api.enem.dev, transcrição das provas do INEP).
// Idempotente: reimportar apenas atualiza as questões existentes.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const current = new Date().getFullYear();
    const years: number[] = (Array.isArray(body.years) ? body.years : [current - 5, current - 4, current - 3, current - 2, current - 1])
      .map(Number).filter((y: number) => y >= 2009 && y <= current).slice(0, 6);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const report: Record<number, number | string> = {};

    for (const year of years) {
      const questions: any[] = [];
      for (let offset = 0; offset < 400; offset += 50) {
        const r = await fetch(`https://api.enem.dev/v1/exams/${year}/questions?limit=50&offset=${offset}`);
        if (!r.ok) break;
        const d = await r.json();
        questions.push(...(d.questions || []));
        if (!d.metadata?.hasMore) break;
      }
      if (!questions.length) { report[year] = "prova não disponível na fonte"; continue; }

      let { data: exam } = await db.from("real_exams").select("id").eq("product_key", "enem").eq("year", year).eq("board", "INEP").maybeSingle();
      if (!exam) {
        const ins = await db.from("real_exams").insert({
          product_key: "enem", year, title: `ENEM ${year} – Prova completa`, board: "INEP", phase: "1º e 2º dia",
          pdf_url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos",
        }).select("id").single();
        exam = ins.data;
      }
      if (!exam) { report[year] = "erro ao criar prova"; continue; }

      const rows = questions
        .filter((q) => !q.language || q.language === "ingles")
        .map((q) => {
          const img = (q.files || []).find((f: string) => f && !f.includes("broken-image"));
          const context = String(q.context || "").replace(/!\[\]\([^)]*broken-image[^)]*\)/g, "").trim();
          const statement = [context, q.alternativesIntroduction].filter(Boolean).join("\n\n");
          return {
            exam_id: exam!.id,
            number: q.index,
            subject: q.language === "ingles" ? "Inglês" : SUBJECTS[q.discipline] || q.discipline,
            statement: statement || `Questão ${q.index}`,
            image_url: img || null,
            options: (q.alternatives || []).map((a: any) => ({ letter: a.letter, text: a.text || (a.file ? "(ver imagem)" : "") })),
            correct: q.correctAlternative || null,
          };
        });
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await db.from("real_exam_questions").upsert(rows.slice(i, i + 100), { onConflict: "exam_id,number" });
        if (error) throw error;
      }
      report[year] = rows.length;
    }
    return json({ ok: true, report });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : JSON.stringify(e) });
  }
});
