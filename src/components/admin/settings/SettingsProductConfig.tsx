import { useEffect, useState } from "react";
import { usePlatformSettings, ProductConfigSettings } from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Video, FileText, StickyNote, Trophy, ClipboardList } from "lucide-react";

const defaultConfig: ProductConfigSettings = {
  revisoes: { max_recording_minutes: 30, enable_recording: true },
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
    if (data) setForm({ ...defaultConfig, ...(data as unknown as ProductConfigSettings) });
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    await update(form as any);
    setSaving(false);
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
            onCheckedChange={(v) =>
              setForm({ ...form, revisoes: { ...form.revisoes, enable_recording: v } })
            }
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
            onChange={(e) =>
              setForm({
                ...form,
                revisoes: {
                  ...form.revisoes,
                  max_recording_minutes: parseInt(e.target.value) || 30,
                },
              })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Limite em minutos para cada gravação de vídeo feita pelo professor.
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
