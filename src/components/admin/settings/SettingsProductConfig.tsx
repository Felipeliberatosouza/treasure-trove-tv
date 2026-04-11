import { useEffect, useState } from "react";
import { usePlatformSettings, ProductConfigSettings } from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Video, FileText, StickyNote, Trophy, ClipboardList, Subtitles, PenTool, Image } from "lucide-react";

const defaultConfig: ProductConfigSettings = {
  revisoes: {
    max_recording_minutes: 30,
    enable_recording: true,
    enable_subtitles: false,
    enable_blackboard: false,
    enable_auto_cover: false,
  },
  colinhas: {},
  resumos: {},
  top_questoes: {},
  simulados: {},
};

const SettingsProductConfig = () => {
  const { data, loading, update } = usePlatformSettings("product_config");
  const [form, setForm] = useState<ProductConfigSettings>(defaultConfig);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      const merged = { ...defaultConfig, ...(data as unknown as ProductConfigSettings) };
      merged.revisoes = { ...defaultConfig.revisoes, ...merged.revisoes };
      setForm(merged);
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    await update(form as any);
    setSaving(false);
  };

  const updateRevisoes = (key: string, value: any) => {
    setForm({ ...form, revisoes: { ...form.revisoes, [key]: value } });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 max-w-lg">
      {/* Revisões - Parâmetros de Gravação */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" /> Revisões — Gravação de Vídeo
        </h3>

        <div className="flex items-center gap-2">
          <Switch
            checked={form.revisoes.enable_recording}
            onCheckedChange={(v) => updateRevisoes("enable_recording", v)}
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
            onChange={(e) => {
              const raw = e.target.value;
              const num = raw === "" ? 0 : parseInt(raw);
              updateRevisoes("max_recording_minutes", isNaN(num) ? 0 : num);
            }}
            onBlur={() => {
              if (!form.revisoes.max_recording_minutes || form.revisoes.max_recording_minutes < 1) {
                updateRevisoes("max_recording_minutes", 1);
              }
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
              onCheckedChange={(v) => updateRevisoes("enable_subtitles", v)}
            />
            <Label className="cursor-pointer flex items-center gap-1.5">
              <Subtitles className="h-3.5 w-3.5 text-primary" />
              Legendas automáticas
            </Label>
          </div>
          <p className="text-xs text-muted-foreground ml-10">
            Gera legendas por IA após a gravação. Exibidas no player de vídeo.
          </p>

          <div className="flex items-center gap-2">
            <Switch
              checked={form.revisoes.enable_blackboard}
              onCheckedChange={(v) => updateRevisoes("enable_blackboard", v)}
            />
            <Label className="cursor-pointer flex items-center gap-1.5">
              <PenTool className="h-3.5 w-3.5 text-primary" />
              Quadro negro com palavras de impacto
            </Label>
          </div>
          <p className="text-xs text-muted-foreground ml-10">
            A IA extrai termos-chave da fala do professor e os exibe em um quadro negro embutido no vídeo.
          </p>

          <div className="flex items-center gap-2">
            <Switch
              checked={form.revisoes.enable_auto_cover}
              onCheckedChange={(v) => updateRevisoes("enable_auto_cover", v)}
            />
            <Label className="cursor-pointer flex items-center gap-1.5">
              <Image className="h-3.5 w-3.5 text-primary" />
              Capa automática de introdução
            </Label>
          </div>
          <p className="text-xs text-muted-foreground ml-10">
            Gera uma capa de introdução com título, área e nome do professor no início do vídeo.
          </p>
        </div>
      </div>

      {/* Outros recursos - placeholder */}
      <div className="rounded-lg border border-border p-4 space-y-2">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Resumos
        </h3>
        <p className="text-xs text-muted-foreground">Configurações de resumos serão adicionadas em breve.</p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-2">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary" /> Colinhas
        </h3>
        <p className="text-xs text-muted-foreground">Configurações de colinhas serão adicionadas em breve.</p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-2">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" /> Top Questões de Provas
        </h3>
        <p className="text-xs text-muted-foreground">Configurações de Top Questões serão adicionadas em breve.</p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-2">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" /> Simulados
        </h3>
        <p className="text-xs text-muted-foreground">Configurações de simulados serão adicionadas em breve.</p>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
};

export default SettingsProductConfig;
