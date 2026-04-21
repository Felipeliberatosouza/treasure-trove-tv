import {
  usePlatformSettings,
  AulaParticularConfigSettings,
  DEFAULT_AULA_PARTICULAR_CONFIG,
} from "@/hooks/usePlatformSettings";
import { Clock, Percent, Users, GraduationCap, Info } from "lucide-react";

const TeacherAulaParticularRulesTab = () => {
  const { data, loading } = usePlatformSettings("aula_particular_config");

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  const cfg: AulaParticularConfigSettings = {
    ...DEFAULT_AULA_PARTICULAR_CONFIG,
    ...((data as AulaParticularConfigSettings) || {}),
  };

  const feeText =
    cfg.late_cancel_fee_type === "percentage"
      ? `${cfg.late_cancel_fee_value}% do valor da aula`
      : `R$ ${cfg.late_cancel_fee_value.toFixed(2)} (valor fixo)`;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-display text-lg font-semibold flex items-center gap-2 mb-1">
          <GraduationCap className="h-5 w-5 text-primary" /> Regras de Aula Particular
        </h2>
        <p className="text-sm text-muted-foreground">
          Estas regras se aplicam a todas as aulas particulares agendadas com você. Os valores
          são definidos pela administração da plataforma.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 p-4 flex gap-3">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Para alterar qualquer uma destas configurações, entre em contato com a administração.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-2">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Duração da aula
        </h3>
        <p className="text-2xl font-bold">{cfg.lesson_duration_minutes} minutos</p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-2">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Janela de cancelamento sem custo
        </h3>
        <p className="text-2xl font-bold">{cfg.free_cancel_window_hours}h de antecedência</p>
        <p className="text-xs text-muted-foreground">
          O aluno pode cancelar sem custo até <strong>{cfg.free_cancel_window_hours}h</strong>{" "}
          antes do horário marcado. Cancelamentos abaixo dessa janela geram a taxa abaixo.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-2">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" /> Taxa de cancelamento tardio
        </h3>
        <p className="text-2xl font-bold">{feeText}</p>
        <p className="text-xs text-muted-foreground">
          Cobrada do aluno quando ele cancela com menos de {cfg.free_cancel_window_hours}h de
          antecedência.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Como a taxa é dividida
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">Você (professor)</p>
            <p className="text-xl font-bold text-primary">{cfg.fee_split_teacher_pct}%</p>
          </div>
          <div className="rounded-md bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">Plataforma</p>
            <p className="text-xl font-bold">{cfg.fee_split_platform_pct}%</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Esta divisão se aplica apenas à <strong>taxa de cancelamento tardio</strong>, como
          compensação pelo horário bloqueado em sua agenda.
        </p>
      </div>
    </div>
  );
};

export default TeacherAulaParticularRulesTab;
