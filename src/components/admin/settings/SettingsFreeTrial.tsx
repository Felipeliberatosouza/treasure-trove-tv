import { useEffect, useState } from "react";
import { usePlatformSettings, FreeTrialSettings } from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Clock, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

const defaults: FreeTrialSettings = {
  enabled: false,
  trial_type: "days",
  trial_days: 7,
  trial_videos: 5,
};

const SettingsFreeTrial = () => {
  const { data, loading, update } = usePlatformSettings("free_trial");
  const [form, setForm] = useState<FreeTrialSettings>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    await update(form);
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
         <h3 className="text-sm font-semibold">Ativar Teste Grátis</h3>
            <p className="text-xs text-muted-foreground">
              Permite que novos usuários experimentem a plataforma antes de assinar. Inclui revisões, resumos, simulados, top questões e colinhas.
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => setForm({ ...form, enabled: v })}
          />
        </div>
      </Card>

      {form.enabled && (
        <Card className="p-5 space-y-5">
          <div>
            <Label className="text-sm font-semibold mb-3 block">Formato do Teste Grátis</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, trial_type: "days" })}
                className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                  form.trial_type === "days"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Clock className={`h-5 w-5 ${form.trial_type === "days" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <span className="text-sm font-medium block">Por Dias</span>
                  <span className="text-xs text-muted-foreground">
                    Acesso livre por um número definido de dias
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, trial_type: "videos" })}
                className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                  form.trial_type === "videos"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <PlayCircle className={`h-5 w-5 ${form.trial_type === "videos" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <span className="text-sm font-medium block">Por Acessos</span>
                  <span className="text-xs text-muted-foreground">
                    Número limitado de acessos a conteúdos (revisões, resumos, simulados, etc.)
                  </span>
                </div>
              </button>
            </div>
          </div>

          {form.trial_type === "days" && (
            <div className="max-w-xs">
              <Label>Número de Dias</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={form.trial_days}
                onChange={(e) => setForm({ ...form, trial_days: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                O usuário terá acesso completo por {form.trial_days} dia{form.trial_days !== 1 ? "s" : ""} após o cadastro.
              </p>
            </div>
          )}

          {form.trial_type === "videos" && (
            <div className="max-w-xs">
              <Label>Número de Acessos</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.trial_videos}
                onChange={(e) => setForm({ ...form, trial_videos: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                O usuário poderá acessar até {form.trial_videos} conteúdo{form.trial_videos !== 1 ? "s" : ""} gratuitamente (revisões, resumos, simulados, top questões e colinhas).
              </p>
            </div>
          )}
        </Card>
      )}

      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Configurações de Teste"}
      </Button>
    </div>
  );
};

export default SettingsFreeTrial;
