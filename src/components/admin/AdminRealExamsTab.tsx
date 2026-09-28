import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PRODUCTS = [
  { key: "enem", name: "ENEM" }, { key: "vestibulares", name: "Vestibulares" },
  { key: "oab", name: "OAB" }, { key: "concursos", name: "Concursos" },
];
type Exam = { id: string; product_key: string; year: number; title: string; board: string | null; phase: string | null; pdf_url: string | null; active: boolean };

// CSV com separador ";" e aspas opcionais
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  const t = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ";") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cur); if (row.some((x) => x.trim())) rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const MODEL = "\uFEFFnumero;disciplina;assunto;enunciado;A;B;C;D;E;gabarito;comentario\n1;Matemática;Porcentagem;\"Texto do enunciado\";opção A;opção B;opção C;opção D;opção E;C;Explicação opcional\n";

export default function AdminRealExamsTab() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ product_key: "enem", year: new Date().getFullYear(), title: "", board: "", phase: "", pdf_url: "" });
  const [importing, setImporting] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("real_exams").select("*").order("product_key").order("year", { ascending: false });
    setExams((data || []) as Exam[]);
    const { data: qs } = await supabase.from("real_exam_questions").select("exam_id");
    const c: Record<string, number> = {}; (qs || []).forEach((q: any) => { c[q.exam_id] = (c[q.exam_id] || 0) + 1; }); setCounts(c);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim()) return toast.error("Informe o nome da prova.");
    const { error } = await supabase.from("real_exams").insert({ ...form, board: form.board || null, phase: form.phase || null, pdf_url: form.pdf_url || null });
    if (error) return toast.error("Não foi possível salvar a prova.");
    toast.success("Prova cadastrada."); setForm({ ...form, title: "", board: "", phase: "", pdf_url: "" }); load();
  };

  const toggle = async (e: Exam) => { await supabase.from("real_exams").update({ active: !e.active }).eq("id", e.id); load(); };
  const remove = async (e: Exam) => { if (!confirm(`Excluir "${e.title}" e todas as suas questões?`)) return; await supabase.from("real_exams").delete().eq("id", e.id); load(); };

  const importFile = async (exam: Exam, file: File) => {
    setImporting(exam.id);
    try {
      const rows = parseCsv(await file.text());
      const [head, ...body] = rows;
      const idx = (n: string) => head.findIndex((h) => h.trim().toLowerCase() === n);
      const letters = ["A", "B", "C", "D", "E"].filter((l) => idx(l.toLowerCase()) >= 0);
      const items = body.map((r) => ({
        exam_id: exam.id,
        number: parseInt(r[idx("numero")], 10),
        subject: r[idx("disciplina")]?.trim() || null,
        topic: r[idx("assunto")]?.trim() || null,
        statement: r[idx("enunciado")]?.trim() || "",
        options: letters.map((l) => ({ letter: l, text: (r[idx(l.toLowerCase())] || "").trim() })).filter((o) => o.text),
        correct: r[idx("gabarito")]?.trim().toUpperCase() || null,
        explanation: idx("comentario") >= 0 ? r[idx("comentario")]?.trim() || null : null,
      })).filter((q) => q.number && q.statement);
      if (!items.length) throw new Error("vazio");
      const { error } = await supabase.from("real_exam_questions").upsert(items, { onConflict: "exam_id,number" });
      if (error) throw error;
      toast.success(`${items.length} questões importadas.`); load();
    } catch {
      toast.error("Não foi possível importar. Confira se a planilha segue o modelo.");
    } finally { setImporting(null); }
  };

  const downloadModel = () => {
    const url = URL.createObjectURL(new Blob([MODEL], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "modelo-questoes.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Provas Reais</h2>
        <p className="text-sm text-muted-foreground">Cadastre as provas oficiais dos últimos 5 anos de ENEM, Vestibulares, OAB e Concursos e importe as questões por planilha.</p>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
        <div><Label>Produto</Label>
          <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.product_key} onChange={(e) => setForm({ ...form, product_key: e.target.value })}>
            {PRODUCTS.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
          </select></div>
        <div><Label>Ano</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} /></div>
        <div><Label>Nome da prova</Label><Input placeholder="Ex.: ENEM 2024 – 1º dia (Azul)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Banca / instituição</Label><Input placeholder="Ex.: FGV, Fuvest, Cebraspe" value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} /></div>
        <div><Label>Fase / edição</Label><Input placeholder="Ex.: 1ª fase, 41º Exame" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} /></div>
        <div><Label>Link do caderno oficial (PDF)</Label><Input placeholder="https://..." value={form.pdf_url} onChange={(e) => setForm({ ...form, pdf_url: e.target.value })} /></div>
        <div className="flex gap-2 sm:col-span-3">
          <Button onClick={create}>Cadastrar prova</Button>
          <Button variant="outline" onClick={downloadModel}>Baixar modelo de planilha</Button>
          <Button variant="secondary" onClick={async () => { toast.info("Atualizando ENEM, aguarde…"); const { data } = await supabase.functions.invoke("import-real-exams", { body: {} }); if (data?.ok) { toast.success("ENEM atualizado."); load(); } else toast.error("Não foi possível atualizar o ENEM agora."); }}>Atualizar ENEM automaticamente</Button>
        </div>
      </div>

      {PRODUCTS.map((p) => {
        const list = exams.filter((e) => e.product_key === p.key);
        return (
          <div key={p.key}>
            <h3 className="mb-2 font-semibold">{p.name} ({list.length})</h3>
            {list.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma prova cadastrada.</p> : (
              <div className="space-y-2">
                {list.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm">
                    <span className="font-medium">{e.year} · {e.title}</span>
                    <span className="text-muted-foreground">{counts[e.id] || 0} questões</span>
                    {!e.active && <span className="text-destructive">oculta</span>}
                    <div className="ml-auto flex gap-2">
                      <label className="cursor-pointer rounded-md border border-input px-3 py-1.5 hover:bg-muted">
                        {importing === e.id ? "Importando…" : "Importar questões"}
                        <input type="file" accept=".csv" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) importFile(e, f); ev.target.value = ""; }} />
                      </label>
                      <Button size="sm" variant="outline" onClick={() => toggle(e)}>{e.active ? "Ocultar" : "Mostrar"}</Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(e)}>Excluir</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
