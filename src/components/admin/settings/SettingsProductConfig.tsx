import { useEffect, useState } from "react";
import {
  usePlatformSettings,
  ProductConfigSettings,
  DEFAULT_PRODUCT_CONFIG,
} from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Save,
  Video,
  FileText,
  StickyNote,
  Trophy,
  ClipboardList,
  Subtitles,
  PenTool,
  Tag,
  Settings as SettingsIcon,
  Type,
  ListChecks,
  Hand,
} from "lucide-react";
import AdminResourcePricingTab from "@/components/admin/AdminResourcePricingTab";

type SubSection = "general" | "pricing" | "limits" | "minimums";

const SettingsProductConfig = () => {
  const { data, loading, update } = usePlatformSettings("product_config");
  const [form, setForm] = useState<ProductConfigSettings>(DEFAULT_PRODUCT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<SubSection>("general");

  useEffect(() => {
    if (data) {
      const d = data as unknown as Partial<ProductConfigSettings>;
      setForm({
        revisoes: { ...DEFAULT_PRODUCT_CONFIG.revisoes, ...(d.revisoes || {}) },
        resumos: { ...DEFAULT_PRODUCT_CONFIG.resumos, ...(d.resumos || {}) },
        simulados: { ...DEFAULT_PRODUCT_CONFIG.simulados, ...(d.simulados || {}) },
        top_questoes: { ...DEFAULT_PRODUCT_CONFIG.top_questoes, ...(d.top_questoes || {}) },
        colinhas: { ...DEFAULT_PRODUCT_CONFIG.colinhas, ...(d.colinhas || {}) },
      });
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    await update(form);
    setSaving(false);
  };

  const updRev = (k: keyof ProductConfigSettings["revisoes"], v: any) =>
    setForm({ ...form, revisoes: { ...form.revisoes, [k]: v } });
  const numField = (val: number, fb: number) =>
    Number.isFinite(val) && val > 0 ? val : fb;

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const subTabs: { id: SubSection; label: string; icon: any }[] = [
    { id: "general", label: "Geral", icon: SettingsIcon },
    { id: "pricing", label: "Preços de Recursos", icon: Tag },
    { id: "limits", label: "Limites de Texto", icon: Type },
    { id: "minimums", label: "Quantidades Mínimas", icon: ListChecks },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap border-b border-border pb-3">
        {subTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              section === t.id
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {section === "pricing" && <AdminResourcePricingTab />}

      {section === "general" && (
        <div className="space-y-6 max-w-lg">
          <div className="rounded-lg border border-border p-4 space-y-4">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" /> Revisões — Gravação de Vídeo
            </h3>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.revisoes.enable_recording}
                onCheckedChange={(v) => updRev("enable_recording", v)}
              />
              <Label className="cursor-pointer">Habilitar gravação de vídeo pelo professor</Label>
            </div>

            <div>
              <Label>Tempo máximo de gravação (minutos)</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={form.revisoes.max_recording_minutes}
                onChange={(e) => updRev("max_recording_minutes", parseInt(e.target.value) || 0)}
                onBlur={() => {
                  if (!form.revisoes.max_recording_minutes || form.revisoes.max_recording_minutes < 1)
                    updRev("max_recording_minutes", 1);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Limite em minutos para cada gravação de vídeo feita pelo professor.
              </p>
            </div>

            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Processamento automático de vídeo (IA)
              </p>

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.revisoes.enable_subtitles}
                  onCheckedChange={(v) => updRev("enable_subtitles", v)}
                />
                <Label className="cursor-pointer flex items-center gap-1.5">
                  <Subtitles className="h-3.5 w-3.5 text-primary" /> Legendas automáticas
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.revisoes.enable_blackboard}
                  onCheckedChange={(v) => updRev("enable_blackboard", v)}
                />
                <Label className="cursor-pointer flex items-center gap-1.5">
                  <PenTool className="h-3.5 w-3.5 text-primary" /> Quadro negro com palavras de impacto
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.revisoes.enable_libras}
                  onCheckedChange={(v) => updRev("enable_libras", v)}
                />
                <Label className="cursor-pointer flex items-center gap-1.5">
                  <Hand className="h-3.5 w-3.5 text-primary" /> Linguagem de Sinais — Libras
                </Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-1 pl-8">
                Quando ativado, exibe um botão de acessibilidade em Libras na página dos vídeos. O aluno pode ativá-lo e fechá-lo a qualquer momento.
              </p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      )}

      {section === "limits" && (
        <div className="space-y-4 max-w-2xl">
          <p className="text-sm text-muted-foreground">
            Defina o número máximo de caracteres permitido em cada campo dos formulários do professor.
            Esses limites são aplicados em tempo real conforme o professor digita.
          </p>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" /> Aula (Revisão)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Título — máx. caracteres</Label>
                <Input
                  type="number" min={10} max={500}
                  value={form.revisoes.title_max}
                  onChange={(e) => updRev("title_max", numField(parseInt(e.target.value), 100))}
                />
              </div>
              <div>
                <Label>Descrição — máx. caracteres</Label>
                <Input
                  type="number" min={20} max={2000}
                  value={form.revisoes.description_max}
                  onChange={(e) => updRev("description_max", numField(parseInt(e.target.value), 200))}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Resumo
            </h3>
            <div>
              <Label>Texto do resumo — máx. caracteres</Label>
              <Input
                type="number" min={50} max={2000}
                value={form.resumos.text_max}
                onChange={(e) =>
                  setForm({ ...form, resumos: { text_max: numField(parseInt(e.target.value), 250) } })
                }
              />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Simulado
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pergunta — máx. caracteres</Label>
                <Input
                  type="number" min={20} max={1000}
                  value={form.simulados.question_max}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      simulados: { ...form.simulados, question_max: numField(parseInt(e.target.value), 200) },
                    })
                  }
                />
              </div>
              <div>
                <Label>Alternativa — máx. caracteres</Label>
                <Input
                  type="number" min={10} max={500}
                  value={form.simulados.option_max}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      simulados: { ...form.simulados, option_max: numField(parseInt(e.target.value), 200) },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> Top Questões
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pergunta — máx. caracteres</Label>
                <Input
                  type="number" min={20} max={1000}
                  value={form.top_questoes.question_max}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      top_questoes: { ...form.top_questoes, question_max: numField(parseInt(e.target.value), 300) },
                    })
                  }
                />
              </div>
              <div>
                <Label>Resposta — máx. caracteres</Label>
                <Input
                  type="number" min={20} max={1000}
                  value={form.top_questoes.answer_max}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      top_questoes: { ...form.top_questoes, answer_max: numField(parseInt(e.target.value), 300) },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" /> Colinha
            </h3>
            <div>
              <Label>Bullet — máx. caracteres</Label>
              <Input
                type="number" min={20} max={500}
                value={form.colinhas.bullet_max}
                onChange={(e) =>
                  setForm({
                    ...form,
                    colinhas: { ...form.colinhas, bullet_max: numField(parseInt(e.target.value), 100) },
                  })
                }
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Limites"}
          </Button>
        </div>
      )}

      {section === "minimums" && (
        <div className="space-y-4 max-w-2xl">
          <p className="text-sm text-muted-foreground">
            Quantidade mínima de itens que o professor deve preencher em cada material antes de publicar.
          </p>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Simulado
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mín. de questões</Label>
                <Input
                  type="number" min={1} max={50}
                  value={form.simulados.min_questions}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      simulados: { ...form.simulados, min_questions: numField(parseInt(e.target.value), 5) },
                    })
                  }
                />
              </div>
              <div>
                <Label>Mín. de alternativas por questão</Label>
                <Input
                  type="number" min={2} max={10}
                  value={form.simulados.min_options}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      simulados: { ...form.simulados, min_options: numField(parseInt(e.target.value), 3) },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> Top Questões
            </h3>
            <div>
              <Label>Mín. de perguntas</Label>
              <Input
                type="number" min={1} max={50}
                value={form.top_questoes.min_questions}
                onChange={(e) =>
                  setForm({
                    ...form,
                    top_questoes: { ...form.top_questoes, min_questions: numField(parseInt(e.target.value), 5) },
                  })
                }
              />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" /> Colinha
            </h3>
            <div>
              <Label>Mín. de bullets</Label>
              <Input
                type="number" min={3} max={50}
                value={form.colinhas.min_bullets}
                onChange={(e) =>
                  setForm({
                    ...form,
                    colinhas: { ...form.colinhas, min_bullets: numField(parseInt(e.target.value), 10) },
                  })
                }
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Mínimos"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SettingsProductConfig;
