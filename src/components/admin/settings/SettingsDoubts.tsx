import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Save, MessageSquare, ShieldAlert, Coins, Users } from "lucide-react";
import { toast } from "sonner";
import {
  DoubtChatConfig,
  DEFAULT_DOUBT_CHAT_CONFIG,
  DEFAULT_BLOCKED_WORDS,
} from "@/hooks/useDoubtChatConfig";

const UNLIMITED = -1;

const SettingsDoubts = () => {
  const [cfg, setCfg] = useState<DoubtChatConfig>(DEFAULT_DOUBT_CHAT_CONFIG);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: row }, { data: planRows }] = await Promise.all([
        supabase.from("platform_settings").select("value").eq("key", "doubt_chat_config").maybeSingle(),
        supabase.from("subscription_plans").select("id, name").eq("active", true).order("sort_order"),
      ]);
      if (row?.value) {
        setCfg({ ...DEFAULT_DOUBT_CHAT_CONFIG, ...(row.value as Partial<DoubtChatConfig>) });
      }
      setPlans(planRows || []);
      setLoading(false);
    })();
  }, []);

  const setPlanValue = (name: string, raw: number) => {
    setCfg((c) => ({
      ...c,
      plan_interactions: {
        ...c.plan_interactions,
        [name]: raw === UNLIMITED ? null : Math.max(0, raw),
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ key: "doubt_chat_config", value: cfg as never }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error("Erro ao salvar as configurações de dúvidas.");
    else toast.success("Configurações de dúvidas salvas.");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Chat de dúvidas (aulas com professor virtual)</h3>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
          <Label className="cursor-pointer">Permitir que alunos enviem dúvidas das aulas de IA</Label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Interações sem plano</Label>
            <Input
              type="number"
              min={0}
              value={cfg.interactions_no_plan}
              onChange={(e) => setCfg({ ...cfg, interactions_no_plan: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div>
            <Label>Prazo de resposta (dias)</Label>
            <Input
              type="number"
              min={1}
              value={cfg.response_deadline_days}
              onChange={(e) => setCfg({ ...cfg, response_deadline_days: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <div>
            <Label className="flex items-center gap-1"><Users className="h-3 w-3" /> Professores notificados</Label>
            <Input
              type="number"
              min={1}
              value={cfg.max_teachers_notified}
              onChange={(e) => setCfg({ ...cfg, max_teachers_notified: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Interações por plano</h3>
        <p className="text-xs text-muted-foreground">
          Quantas perguntas o aluno pode fazer em cada dúvida. Use <strong>-1</strong> para interações ilimitadas.
        </p>
        <div className="space-y-2">
          {plans.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum plano ativo cadastrado.</p>
          )}
          {plans.map((p) => {
            const v = cfg.plan_interactions[p.name];
            return (
              <div key={p.id} className="flex items-center gap-3">
                <Label className="flex-1 text-sm">{p.name}</Label>
                <Input
                  className="w-32"
                  type="number"
                  min={-1}
                  value={v === null ? UNLIMITED : v ?? cfg.interactions_no_plan}
                  onChange={(e) => setPlanValue(p.name, Number(e.target.value))}
                />
                <span className="w-24 text-xs text-muted-foreground">
                  {v === null ? "Ilimitado" : "interações"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Créditos de IA e bônus do professor</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Créditos de IA por interação extra</Label>
            <Input
              type="number"
              min={0}
              value={cfg.credit_cost_per_interaction}
              onChange={(e) => setCfg({ ...cfg, credit_cost_per_interaction: Math.max(0, Number(e.target.value) || 0) })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Cobrado quando o aluno já usou todas as interações do plano.
            </p>
          </div>
          <div>
            <Label>Bônus por dúvida respondida (R$)</Label>
            <CurrencyInput
              value={cfg.teacher_bonus_brl}
              onValueChange={(v) => setCfg({ ...cfg, teacher_bonus_brl: v })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Opcional. Zero desliga o pagamento de bônus por resposta.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-semibold">Palavras bloqueadas</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Uma palavra por linha. Telefones, e-mails, sites e perfis de redes sociais já são
          bloqueados automaticamente em qualquer mensagem.
        </p>
        <Textarea
          rows={8}
          value={(cfg.blocked_words || []).join("\n")}
          onChange={(e) =>
            setCfg({ ...cfg, blocked_words: e.target.value.split("\n").map((w) => w.trim()).filter(Boolean) })
          }
        />
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setCfg({ ...cfg, blocked_words: DEFAULT_BLOCKED_WORDS })}
        >
          Restaurar lista padrão
        </Button>
      </Card>

      <Button onClick={save} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
};

export default SettingsDoubts;
