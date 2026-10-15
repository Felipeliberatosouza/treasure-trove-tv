import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { CuratedLesson } from "@/components/products/CuratedLessonsSection";

const PRODUCTS = [
  { key: "oab", name: "OAB" }, { key: "concursos", name: "Concursos" }, { key: "enem", name: "ENEM" },
  { key: "vestibulares", name: "Vestibulares" }, { key: "provas", name: "Provas" },
];

type Row = CuratedLesson & { published: boolean };

const AdminCuratedLessonsTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [productKey, setProductKey] = useState("oab");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [script, setScript] = useState("");
  const [sources, setSources] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => supabase.from("curated_lessons").select("*").order("created_at", { ascending: false })
    .then(({ data }) => setRows((data as Row[]) || []));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!title.trim() || !script.trim()) { toast({ title: "Preencha o título e o roteiro.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      let audio_path: string | null = null;
      if (audio) {
        const ext = (audio.name.split(".").pop() || "mp3").toLowerCase();
        if (!["mp3", "m4a", "wav", "ogg", "webm"].includes(ext)) throw new Error("Envie o podcast em MP3, M4A, WAV, OGG ou WEBM.");
        audio_path = `${productKey}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("curated-audio").upload(audio_path, audio, { contentType: audio.type || undefined });
        if (error) throw new Error("Não foi possível enviar o podcast.");
      }
      const { error } = await supabase.from("curated_lessons").insert({
        product_key: productKey, title: title.trim(), summary: summary.trim() || null, script: script.trim(),
        sources: sources.trim() || null, audio_path, created_by: user?.id, published: true,
      });
      if (error) throw new Error("Não foi possível publicar o conteúdo.");
      toast({ title: "Conteúdo publicado na página do produto." });
      setTitle(""); setSummary(""); setScript(""); setSources(""); setAudio(null);
      load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const toggle = async (r: Row) => {
    await supabase.from("curated_lessons").update({ published: !r.published, updated_at: new Date().toISOString() }).eq("id", r.id);
    load();
  };
  const remove = async (r: Row) => {
    if (!confirm(`Excluir "${r.title}"?`)) return;
    if (r.audio_path) await supabase.storage.from("curated-audio").remove([r.audio_path]);
    await supabase.from("curated_lessons").delete().eq("id", r.id);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">Curadoria Oficial (NotebookLM)</h2>
        <p className="text-sm text-muted-foreground">
          1) No NotebookLM, carregue editais e leis oficiais. 2) Copie o roteiro gerado (use "## Título" para separar os slides) e baixe o podcast (Resumo em Áudio). 3) Cole e envie aqui — publica na hora como aula fixa com o selo "Conteúdo oficial curado".
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Produto</Label>
            <select value={productKey} onChange={(e) => setProductKey(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {PRODUCTS.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
          </div>
          <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ética na OAB — Estatuto da Advocacia" /></div>
        </div>
        <div><Label>Resumo curto (opcional)</Label><Input value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
        <div><Label>Roteiro do NotebookLM</Label><Textarea rows={10} value={script} onChange={(e) => setScript(e.target.value)} placeholder={"## Introdução\nTexto...\n\n## Princípio 1\nTexto..."} /></div>
        <div><Label>Fontes oficiais (editais, leis, artigos)</Label><Textarea rows={2} value={sources} onChange={(e) => setSources(e.target.value)} /></div>
        <div><Label>Podcast (opcional)</Label><Input type="file" accept="audio/*" onChange={(e) => setAudio(e.target.files?.[0] || null)} /></div>
        <Button onClick={save} disabled={saving}>{saving ? "Publicando..." : "Publicar"}</Button>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">{PRODUCTS.find((p) => p.key === r.product_key)?.name} · {new Date(r.created_at).toLocaleDateString("pt-BR")}{r.audio_path ? " · com podcast" : ""}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs">{r.published ? "Publicado" : "Oculto"}</span>
              <Switch checked={r.published} onCheckedChange={() => toggle(r)} />
              <Button variant="ghost" size="sm" onClick={() => remove(r)}>Excluir</Button>
            </div>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-muted-foreground">Nenhum conteúdo curado ainda.</p>}
      </div>
    </div>
  );
};

export default AdminCuratedLessonsTab;
