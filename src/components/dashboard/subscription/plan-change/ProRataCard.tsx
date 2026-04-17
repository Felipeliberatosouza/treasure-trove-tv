import { Wallet, CreditCard } from "lucide-react";

interface Props {
  currentPlanName: string;
  currentPlanPrice: number;
  newPlanName: string;
  newPlanPrice: number;
  daysUsed: number;
  totalDays: number;
}

export function ProRataCard({
  currentPlanName, currentPlanPrice, newPlanName, newPlanPrice, daysUsed, totalDays,
}: Props) {
  const remainingDays = Math.max(0, totalDays - daysUsed);
  const dailyRateCurrent = totalDays > 0 ? currentPlanPrice / totalDays : 0;
  const creditRemaining = dailyRateCurrent * remainingDays;
  const dailyRateNew = totalDays > 0 ? newPlanPrice / totalDays : 0;
  const costRemaining = dailyRateNew * remainingDays;
  const proRata = costRemaining - creditRemaining;
  const isCharge = proRata >= 0;

  // Semantic tokens: warning = charge (amber), success = credit (green)
  const accentBorder = isCharge ? "border-warning/50" : "border-success/50";
  const accentBg = isCharge ? "bg-warning/10" : "bg-success/10";
  const iconBg = isCharge ? "bg-warning/20 text-warning" : "bg-success/20 text-success";
  const accentText = isCharge ? "text-warning" : "text-success";

  return (
    <div className="space-y-2">
      {/* Highlighted summary card */}
      <div className={`rounded-lg border-2 p-4 ${accentBorder} ${accentBg}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
            {isCharge ? <CreditCard className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium uppercase tracking-wider ${accentText}`}>
              {isCharge ? "Valor a pagar agora" : "Crédito a seu favor"}
            </p>
            <p className={`text-2xl font-bold leading-tight ${accentText}`}>
              R$ {Math.abs(proRata).toFixed(2)}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {isCharge
            ? `Diferença proporcional pelos ${remainingDays} dias restantes do ciclo. A partir da próxima renovação: R$ ${newPlanPrice.toFixed(2)}/mês.`
            : `Crédito aplicado na próxima fatura. A partir da próxima renovação: R$ ${newPlanPrice.toFixed(2)}/mês.`
          }
        </p>
      </div>

      {/* Detailed breakdown */}
      <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
        <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Detalhamento</p>
        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span>Dias usados no ciclo atual</span>
          <span className="text-right">{daysUsed} de {totalDays}</span>
          <span>Crédito restante ({currentPlanName})</span>
          <span className="text-right text-success">- R$ {creditRemaining.toFixed(2)}</span>
          <span>Custo restante ({newPlanName})</span>
          <span className="text-right">R$ {costRemaining.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
