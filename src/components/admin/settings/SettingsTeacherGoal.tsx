import { useEffect, useState } from "react";
import { Target, Loader2, Save, FileText, Users, Megaphone, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface ContentGoals {
  revisoes: number;
  resolucoes: number;
  resumos: number;
  colinhas: number;
  simulados: number;
  top_questoes: number;
}
interface RelationshipGoals {
  agenda_weekly_updates: number;
  completed_lessons: number;
  doubts_answered_in_time: number;
}
interface TeacherGoalSettings {
  monthly_goal: number;
  content_goals: ContentGoals;
  relationship_goals: RelationshipGoals;
  sales_posts_goal: number;
  doubt_response_hours: number;
  email_alerts_enabled: boolean;
}

const DEFAULTS: TeacherGoalSettings = {
  monthly_goal: 8,
  content_goals: { revisoes: 4, resolucoes: 4, resumos: 2, colinhas: 2, simulados: 2, top_questoes: 2 },
  relationship_goals: { agenda_weekly_updates: 4, completed_lessons: 4, doubts_answered_in_time: 5 },
  sales_posts_goal: 2,
  doubt_response_hours: 48,
  email_alerts_enabled: true,
};

const CONTENT_LABELS: Record<keyof ContentGoals, string> = {
  revisoes: "Revisões de Aulas",
  resolucoes: "Resolução de Provas",
  resumos: "Resumos",
  colinhas: "Colinhas",
  simulados: "Simulados",
  top_questoes: "Top Questões de Provas",
};

const RELATIONSHIP_LABELS: Record<keyof RelationshipGoals, string> = {
  agenda_weekly_updates: "Atualizações Semanais de Agenda (por mês)",
  completed_lessons: "Aulas Agendadas Realizadas (por mês)",
  doubts_answered_in_time: "Dúvidas Respondidas no Prazo (por mês)",
};

const SUB_TABS = [
  { id: "content", label: "Conteúdo", icon: FileText },
  { id: "relationship", label: "Relação com Alunos", icon: Users },
  { id: "posts", label: "Posts de Propaganda", icon: Megaphone },
  { id: "general", label: "Geral", icon: SettingsIcon },
] as const;

type SubTabId = (typeof SUB_TABS)[number]["id"];

const SettingsTeacherGoal = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSub, setActiveSub] = useState<SubTabId>("content");
  const [settings, setSettings] = useState<TeacherGoalSettings>(DEFAULTS);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "teacher_content_goal")
        .maybeSingle();
      const merged: TeacherGoalSettings = {
        ...DEFAULTS,
        ...((data?.value as Partial<TeacherGoalSettings>) || {}),
        content_goals: { ...DEFAULTS.content_goals, ...((data?.value as any)?.content_goals || {}) },
        relationship_goals: { ...DEFAULTS.relationship_goals, ...((data?.value as any)?.relationship_goals || {}) },
      };
      setSettings(merged);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: settings as any })
      .eq("key", "teacher_content_goal");
    setSaving(false);
    if (error) toast.error("Erro ao salvar metas");
    else toast.success("Metas atualizadas");
  };

  const updateContent = (k: keyof ContentGoals, v: number) =>
    setSettings((s) => ({ ...s, content_goals: { ...s.content_goals, [k]: Math.max(0, v) } }));

  const updateRelation = (k: keyof RelationshipGoals, v: number) =>
    setSettings((s) => ({ ...s, relationship_goals: { ...s.relationship_goals, [k]: Math.max(0, v) } }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-display text-base font-semibold mb-2 flex items-center gap-2">
        <Target className="h-4 w-4" /> Metas do Professor
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        Configure metas mensais que o professor deve atingir. Cada categoria tem acompanhamento automático
        e pode disparar alertas por e-mail caso esteja abaixo do esperado no fim do mês.
      </p>

      <div className="flex gap-2 flex-wrap mb-6 border-b border-border pb-4">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveSub(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              activeSub === t.id
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {activeSub === "content" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="font-medium text-sm mb-1">Meta de Inserção de Conteúdo</h4>
            <p className="text-xs text-muted-foreground mb-4">
              Quantidade mínima mensal que o professor deve publicar em cada categoria.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(Object.keys(CONTENT_LABELS) as (keyof ContentGoals)[]).map((k) => (
                <div key={k}>
                  <Label htmlFor={`c-${k}`} className="text-xs">{CONTENT_LABELS[k]}</Label>
                  <Input
                    id={`c-${k}`}
                    type="number"
                    min={0}
                    value={settings.content_goals[k]}
                    onChange={(e) => updateContent(k, parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSub === "relationship" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="font-medium text-sm mb-1">Meta de Relação com Alunos</h4>
            <p className="text-xs text-muted-foreground mb-4">
              Indicadores de engajamento mensal do professor com seus alunos.
            </p>
            <div className="space-y-3">
              {(Object.keys(RELATIONSHIP_LABELS) as (keyof RelationshipGoals)[]).map((k) => (
                <div key={k} className="grid grid-cols-[1fr_120px] items-end gap-3">
                  <Label htmlFor={`r-${k}`} className="text-xs">{RELATIONSHIP_LABELS[k]}</Label>
                  <Input
                    id={`r-${k}`}
                    type="number"
                    min={0}
                    value={settings.relationship_goals[k]}
                    onChange={(e) => updateRelation(k, parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <Label htmlFor="response-hours" className="text-sm font-medium">
              Prazo máximo para resposta de dúvidas (em horas)
            </Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Dúvidas respondidas dentro deste prazo contam para a meta. Padrão: 48h.
            </p>
            <Input
              id="response-hours"
              type="number"
              min={1}
              className="max-w-xs"
              value={settings.doubt_response_hours}
              onChange={(e) =>
                setSettings((s) => ({ ...s, doubt_response_hours: Math.max(1, parseInt(e.target.value, 10) || 1) }))
              }
            />
          </div>
        </div>
      )}

      {activeSub === "posts" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="font-medium text-sm mb-1">Meta de Criação de Posts de Propaganda</h4>
          <p className="text-xs text-muted-foreground mb-4">
            Quantidade mínima de posts de divulgação que o professor deve criar por mês.
          </p>
          <div className="max-w-xs">
            <Label htmlFor="posts-goal" className="text-xs">Posts por mês</Label>
            <Input
              id="posts-goal"
              type="number"
              min={0}
              value={settings.sales_posts_goal}
              onChange={(e) =>
                setSettings((s) => ({ ...s, sales_posts_goal: Math.max(0, parseInt(e.target.value, 10) || 0) }))
              }
            />
          </div>
        </div>
      )}

      {activeSub === "general" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <Label htmlFor="monthly-total" className="text-sm font-medium">
              Meta total mensal (referência geral)
            </Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Valor total agregado de publicações esperadas. Usado em relatórios resumidos.
            </p>
            <Input
              id="monthly-total"
              type="number"
              min={0}
              className="max-w-xs"
              value={settings.monthly_goal}
              onChange={(e) =>
                setSettings((s) => ({ ...s, monthly_goal: Math.max(0, parseInt(e.target.value, 10) || 0) }))
              }
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Alertas por e-mail</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Envia resumo semanal e alerta no fim do mês quando o professor estiver abaixo da meta.
              </p>
            </div>
            <Switch
              checked={settings.email_alerts_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, email_alerts_enabled: v }))}
            />
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
};

export default SettingsTeacherGoal;
