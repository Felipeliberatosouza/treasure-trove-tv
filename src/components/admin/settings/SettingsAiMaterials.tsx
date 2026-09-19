import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Pencil, Trash2, Save, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { useCourseAreas } from "@/hooks/useCourseAreas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AgeGroup, KitBoardStep, KitKeyword } from "@/lib/revisionKit";

interface KitSlide {
  titulo?: string;
  bullets?: string[];
  narracao?: string;
  imagem_prompt?: string;
  frase_didatica?: string;
  palavras_chave?: KitKeyword[];
  modo_visual?: "conteudo" | "lousa" | "avatar";
  lousa_passos?: KitBoardStep[];
}

interface KitData {
  titulo?: string;
  assunto?: string;
  disciplina?: string;
  slides?: KitSlide[];
  faixa_etaria?: AgeGroup;
  confianca_faixa_etaria?: number;
  [key: string]: unknown;
}

interface MaterialRow {
  id: string;
  assunto: string;
  disciplina: string | null;
  areas: string[];
  status: string;
  visibility: string;
  updated_at: string;
  hits: number;
  kit: KitData;
  faixa_etaria: AgeGroup;
  confianca_faixa_etaria: number;
}

const AGE_LABELS: Record<AgeGroup, string> = {
  criancas_0_9: "Crianças — 0 a 9 anos",
  pre_adolescentes_10_13: "Pré-adolescentes — 10 a 13 anos",
  adolescentes_14_17: "Adolescentes — 14 a 17 anos",
  jovens_18_25: "Jovens universitários — 18 a 25 anos",
  adultos_26_45: "Adultos — 26 a 45 anos",
  adultos_46_mais: "Adultos maduros — acima de 46 anos",
};

/** Gestão dos materiais já gerados por IA: edição (inclusive da narração) e exclusão. */
const SettingsAiMaterials = () => {
  const { areas: courseAreas } = useCourseAreas();
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MaterialRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_canonical_contents")
      .select("id, assunto, disciplina, areas, status, visibility, updated_at, hits, kit, faixa_etaria, confianca_faixa_etaria")
      .order("updated_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast.error("Não foi possível carregar os materiais de IA.");
      return;
    }
    setRows(
      (data ?? []).map((r) => ({
        ...r,
        areas: ((r as { areas?: string[] | null }).areas ?? []) as string[],
        kit: (r.kit ?? {}) as KitData,
      })) as MaterialRow[],
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((r) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${r.assunto} ${r.disciplina ?? ""} ${r.kit?.titulo ?? ""}`.toLowerCase().includes(term);
  });

  const patchSlide = (index: number, changes: Partial<KitSlide>) =>
    setEditing((cur) =>
      cur
        ? {
            ...cur,
            kit: {
              ...cur.kit,
              slides: (cur.kit.slides ?? []).map((s, i) => (i === index ? { ...s, ...changes } : s)),
            },
          }
        : cur,
    );

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("ai_canonical_contents")
      .update({
        assunto: editing.assunto.trim(),
        disciplina: editing.disciplina?.trim() || null,
        areas: editing.areas,
        faixa_etaria: editing.faixa_etaria,
        kit: editing.kit as never,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar as alterações.");
      return;
    }
    toast.success("Material atualizado.");
    setEditing(null);
    void load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("ai_canonical_contents").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) {
      toast.error("Não foi possível excluir o material.");
      return;
    }
    toast.success("Material excluído.");
    void load();
  };

  if (editing) {
    const slides = editing.kit.slides ?? [];
    return (
      <div className="max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Editar material de IA</h3>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Voltar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mat-titulo">Título</Label>
            <Input
              id="mat-titulo"
              value={editing.kit.titulo ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, kit: { ...editing.kit, titulo: e.target.value } })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mat-disciplina">Disciplina</Label>
            <Input
              id="mat-disciplina"
              value={editing.disciplina ?? ""}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  disciplina: e.target.value,
                  kit: { ...editing.kit, disciplina: e.target.value },
                })
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="mat-assunto">Assunto</Label>
            <Input
              id="mat-assunto"
              value={editing.assunto}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  assunto: e.target.value,
                  kit: { ...editing.kit, assunto: e.target.value },
                })
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Faixa etária detectada</Label>
            <Select value={editing.faixa_etaria} onValueChange={(value) => setEditing({ ...editing, faixa_etaria: value as AgeGroup, kit: { ...editing.kit, faixa_etaria: value as AgeGroup } })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(AGE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Confiança da detecção: {Math.round((editing.confianca_faixa_etaria || 0) * 100)}%</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Áreas de curso vinculadas</Label>
            <p className="text-xs text-muted-foreground">
              Define o avatar usado, a faixa da área na página inicial e a entrega para alunos
              interessados na área. A classificação inicial é automática.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {courseAreas.map((area) => {
                const checked = editing.areas.includes(area.name);
                return (
                  <label key={area.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        setEditing({
                          ...editing,
                          areas: v
                            ? [...editing.areas, area.name]
                            : editing.areas.filter((a) => a !== area.name),
                        })
                      }
                    />
                    {area.name}
                  </label>
                );
              })}
              {courseAreas.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma área de curso cadastrada.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold">Slides e narração</h4>
          {slides.length === 0 && (
            <p className="text-sm text-muted-foreground">Este material não possui slides.</p>
          )}
          {slides.map((slide, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 p-4">
                <div className="space-y-2">
                  <Label htmlFor={`slide-titulo-${index}`}>Slide {index + 1} — título</Label>
                  <Input
                    id={`slide-titulo-${index}`}
                    value={slide.titulo ?? ""}
                    onChange={(e) => patchSlide(index, { titulo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`slide-frase-${index}`}>Frase didática</Label>
                  <Input id={`slide-frase-${index}`} value={slide.frase_didatica ?? ""} onChange={(e) => patchSlide(index, { frase_didatica: e.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`slide-palavras-${index}`}>Palavras-chave (uma por linha)</Label>
                    <Textarea id={`slide-palavras-${index}`} rows={4} value={(slide.palavras_chave ?? []).map((item) => `${item.termo} | ${item.ancora}`).join("\n")} onChange={(e) => patchSlide(index, { palavras_chave: e.target.value.split("\n").filter(Boolean).map((line) => { const [termo, ancora] = line.split("|").map((part) => part.trim()); return { termo, ancora: ancora || termo }; }) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`slide-lousa-${index}`}>Passos da lousa (um por linha)</Label>
                    <Textarea id={`slide-lousa-${index}`} rows={4} value={(slide.lousa_passos ?? []).map((item) => `${item.tipo} | ${item.conteudo} | ${item.ancora}`).join("\n")} onChange={(e) => patchSlide(index, { lousa_passos: e.target.value.split("\n").filter(Boolean).map((line) => { const [tipo, conteudo, ancora] = line.split("|").map((part) => part.trim()); const valid = ["texto", "operacao", "seta", "linha", "circulo", "desenho"].includes(tipo); return { tipo: valid ? tipo as KitBoardStep["tipo"] : "texto", conteudo, ancora: ancora || conteudo }; }) })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`slide-bullets-${index}`}>Tópicos (um por linha)</Label>
                  <Textarea
                    id={`slide-bullets-${index}`}
                    rows={3}
                    value={(slide.bullets ?? []).join("\n")}
                    onChange={(e) =>
                      patchSlide(index, { bullets: e.target.value.split("\n").filter(Boolean) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`slide-narracao-${index}`}>Narração</Label>
                  <Textarea
                    id={`slide-narracao-${index}`}
                    rows={5}
                    value={slide.narracao ?? ""}
                    onChange={(e) => patchSlide(index, { narracao: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ao alterar a narração, o áudio é gerado novamente na próxima reprodução.
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por assunto ou disciplina"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Atualizar
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando materiais…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nenhum material gerado por IA encontrado.
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((row) => (
          <Card key={row.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{row.kit?.titulo || row.assunto}</p>
                <p className="text-xs text-muted-foreground">
                  {[row.disciplina, `${(row.kit?.slides ?? []).length} slides`, `${row.hits} usos`]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant={row.status === "ready" ? "secondary" : "outline"}>{row.status}</Badge>
                  <Badge variant="outline">{row.visibility}</Badge>
                  {row.areas.map((a) => (
                    <Badge key={a} variant="secondary">{a}</Badge>
                  ))}
                  {row.areas.length === 0 && <Badge variant="outline">sem área</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link to={`/conteudo-ia/${row.id}`} target="_blank">
                    <ExternalLink className="mr-1 h-4 w-4" /> Ver
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                  <Pencil className="mr-1 h-4 w-4" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteId(row.id)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir material de IA?</AlertDialogTitle>
            <AlertDialogDescription>
              O material sai do ar imediatamente e não poderá ser recuperado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsAiMaterials;
