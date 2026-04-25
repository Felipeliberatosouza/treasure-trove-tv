import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Info } from "lucide-react";

interface PoolProximityAlertsProps {
  poolAmount: number;
  proportionalShare: number | null;
  uniqueAccesses: number;
  poolMinPerAccess: number;
  poolMaxSharePct: number;
  floorApplied: boolean;
  capApplied: boolean;
  totalMinutes: number;
  totalPlatformMinutes: number | null;
}

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

/**
 * Alertas preventivos de proximidade do TETO ou PISO no cálculo do Pool.
 *
 * - Próximo do TETO: share proporcional já está em 80%+ do teto, mas ainda não atingiu.
 * - Próximo do PISO: share proporcional <= 120% do piso (volume baixo prestes a acionar piso).
 * - Sem dados de plataforma: avisa que ainda não dá para estimar.
 */
const PoolProximityAlerts = ({
  poolAmount,
  proportionalShare,
  uniqueAccesses,
  poolMinPerAccess,
  poolMaxSharePct,
  floorApplied,
  capApplied,
  totalMinutes,
  totalPlatformMinutes,
}: PoolProximityAlertsProps) => {
  const floorValue = uniqueAccesses * poolMinPerAccess;
  const capValue = poolAmount * (poolMaxSharePct / 100);

  const hasData =
    totalPlatformMinutes != null && totalPlatformMinutes > 0 && proportionalShare != null;

  // Distâncias relativas
  const capRatio = hasData && capValue > 0 ? (proportionalShare as number) / capValue : 0;
  const floorRatio = hasData && floorValue > 0 ? (proportionalShare as number) / floorValue : 0;

  // Limiares de proximidade
  const NEAR_CAP = 0.8;       // >= 80% do teto e < 100%
  const NEAR_FLOOR = 1.2;     // proporcional <= 120% do piso

  const alerts: Array<{ key: string; node: JSX.Element }> = [];

  // Sem dados — apenas se também não há piso/teto aplicados
  if (!hasData && !floorApplied && !capApplied) {
    alerts.push({
      key: "nodata",
      node: (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Sem dados suficientes para alertas</p>
            <p className="text-muted-foreground">
              Assim que houver consumo seu/da plataforma, mostraremos avisos quando você se aproximar do piso ou do teto do Pool.
            </p>
          </div>
        </div>
      ),
    });
  }

  // Alerta TETO (já aplicado tem precedência sobre proximidade)
  if (capApplied) {
    alerts.push({
      key: "cap-applied",
      node: (
        <div className="flex items-start gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 p-2 text-xs">
          <ArrowDownToLine className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-blue-700 dark:text-blue-400">
              Teto atingido — sua fatia foi limitada a {poolMaxSharePct}% do Pool
            </p>
            <p className="text-muted-foreground">
              Limite atual: <strong>{formatBRL(capValue)}</strong>. Consumo extra acima disso é
              redistribuído entre os outros professores.
            </p>
          </div>
        </div>
      ),
    });
  } else if (hasData && capRatio >= NEAR_CAP && capValue > 0) {
    const pctOfCap = Math.min(capRatio * 100, 99.9);
    alerts.push({
      key: "near-cap",
      node: (
        <div className="flex items-start gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 p-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-blue-700 dark:text-blue-400">
              Você está próximo do teto ({pctOfCap.toFixed(0)}% do limite)
            </p>
            <p className="text-muted-foreground">
              Sua fatia proporcional ({formatBRL(proportionalShare as number)}) está se aproximando
              do teto de {poolMaxSharePct}% do Pool ({formatBRL(capValue)}). Acima desse valor, o
              consumo extra <strong>não aumenta</strong> seu repasse.
            </p>
          </div>
        </div>
      ),
    });
  }

  // Alerta PISO
  if (floorApplied) {
    alerts.push({
      key: "floor-applied",
      node: (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          <ArrowUpFromLine className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Piso mínimo acionado — volume baixo neste mês
            </p>
            <p className="text-muted-foreground">
              Sua fatia proporcional ficou abaixo do piso garantido de {formatBRL(poolMinPerAccess)} por
              acesso único ({uniqueAccesses} acessos = <strong>{formatBRL(floorValue)}</strong>). O
              piso foi aplicado para proteger sua remuneração.
            </p>
          </div>
        </div>
      ),
    });
  } else if (hasData && floorRatio > 0 && floorRatio <= NEAR_FLOOR && uniqueAccesses > 0) {
    alerts.push({
      key: "near-floor",
      node: (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Volume baixo — você está perto de acionar o piso mínimo
            </p>
            <p className="text-muted-foreground">
              Seu cálculo proporcional ({formatBRL(proportionalShare as number)}) está apenas{" "}
              {(floorRatio * 100).toFixed(0)}% acima do piso ({formatBRL(floorValue)} ={" "}
              {uniqueAccesses} acessos × {formatBRL(poolMinPerAccess)}). Se o consumo cair, o piso
              será aplicado automaticamente para garantir sua remuneração mínima.
            </p>
          </div>
        </div>
      ),
    });
  } else if (hasData && uniqueAccesses === 0 && totalMinutes > 0) {
    // Caso de borda: tem consumo de vídeo mas zero acessos a materiais → piso = 0
    alerts.push({
      key: "no-accesses",
      node: (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Sem acessos a materiais ainda
            </p>
            <p className="text-muted-foreground">
              O piso mínimo é calculado por acesso único a materiais ({formatBRL(poolMinPerAccess)} cada).
              Sem acessos registrados, não há piso garantido neste mês — sua remuneração será
              proporcional ao consumo total.
            </p>
          </div>
        </div>
      ),
    });
  }

  if (alerts.length === 0) return null;

  return <div className="space-y-2">{alerts.map((a) => <div key={a.key}>{a.node}</div>)}</div>;
};

export default PoolProximityAlerts;
