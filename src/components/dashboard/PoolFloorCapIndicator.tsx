import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Info } from "lucide-react";

/**
 * Explica em linguagem clara o ajuste de piso/teto aplicado no cálculo do Pool.
 *
 * Lógica do cálculo (idêntica ao run-teacher-payout / get-teacher-live-stats):
 *   share_proporcional = pool_amount * (consumo_min / consumo_total_plataforma_min)
 *   piso  = unique_accesses * pool_min_per_access_brl
 *   teto  = pool_amount * (pool_max_share_pct / 100)
 *   valor_base_final = clamp(share_proporcional, piso, teto)
 */

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

interface Props {
  poolAmount: number;            // pool total do mês
  poolBase: number;              // valor base que ficou (após piso/teto)
  proportionalShare?: number | null; // valor proporcional cru (antes piso/teto). Se ausente, é estimado.
  uniqueAccesses: number;        // acessos únicos a materiais
  poolMinPerAccess?: number;     // piso por acesso (R$)
  poolMaxSharePct?: number;      // teto (% sobre poolAmount)
  totalMinutes: number;          // consumo do professor (min)
  totalPlatformMinutes?: number | null; // consumo total da plataforma (min)
  floorApplied: boolean;
  capApplied: boolean;
  compact?: boolean;             // versão reduzida
}

const PoolFloorCapIndicator = ({
  poolAmount,
  poolBase,
  proportionalShare,
  uniqueAccesses,
  poolMinPerAccess,
  poolMaxSharePct,
  totalMinutes,
  totalPlatformMinutes,
  floorApplied,
  capApplied,
  compact = false,
}: Props) => {
  const minPerAccess = Number(poolMinPerAccess ?? 0.3);
  const maxSharePct = Number(poolMaxSharePct ?? 15);
  const floorValue = uniqueAccesses * minPerAccess;
  const capValue = poolAmount * (maxSharePct / 100);

  // Se proportionalShare não veio do backend, estima a partir de minutos
  const proportional = (() => {
    if (proportionalShare != null) return Number(proportionalShare);
    if (totalPlatformMinutes && totalPlatformMinutes > 0) {
      return poolAmount * (totalMinutes / totalPlatformMinutes);
    }
    return null;
  })();

  if (!floorApplied && !capApplied) {
    return (
      <div className={`flex items-start gap-2 rounded-md border border-border bg-secondary/30 p-2 ${compact ? "text-xs" : "text-sm"}`}>
        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Cálculo proporcional aplicado</p>
          <p className="text-xs text-muted-foreground">
            Sua fatia ({formatBRL(poolBase)}) ficou dentro dos limites: acima do piso ({formatBRL(floorValue)}) e abaixo do teto ({formatBRL(capValue)}).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {floorApplied && (
        <div className={`flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 ${compact ? "text-xs" : "text-sm"}`}>
          <ArrowUpFromLine className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-700 dark:text-amber-400">Piso mínimo aplicado</p>
            <p className="text-xs text-muted-foreground">
              Sua fatia proporcional foi <strong>elevada</strong> para garantir o piso de {formatBRL(minPerAccess)} por acesso único.
            </p>
            <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {proportional != null && (
                <li>• Cálculo proporcional: <strong>{formatBRL(proportional)}</strong> ({Number(totalMinutes).toFixed(0)} min de consumo)</li>
              )}
              <li>• Piso garantido: {uniqueAccesses} acessos × {formatBRL(minPerAccess)} = <strong>{formatBRL(floorValue)}</strong></li>
              <li>• Valor base após piso: <strong className="text-foreground">{formatBRL(poolBase)}</strong></li>
            </ul>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Mesmo com pouco volume, você foi remunerado pelo piso mínimo por acesso.</span>
            </p>
          </div>
        </div>
      )}

      {capApplied && (
        <div className={`flex items-start gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 p-2 ${compact ? "text-xs" : "text-sm"}`}>
          <ArrowDownToLine className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-blue-700 dark:text-blue-400">Teto máximo aplicado</p>
            <p className="text-xs text-muted-foreground">
              Sua fatia proporcional foi <strong>limitada</strong> ao teto de {maxSharePct}% do Pool por professor.
            </p>
            <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {proportional != null && (
                <li>• Cálculo proporcional: <strong>{formatBRL(proportional)}</strong> ({Number(totalMinutes).toFixed(0)} min de consumo)</li>
              )}
              <li>• Teto: {maxSharePct}% × {formatBRL(poolAmount)} = <strong>{formatBRL(capValue)}</strong></li>
              <li>• Valor base após teto: <strong className="text-foreground">{formatBRL(poolBase)}</strong></li>
            </ul>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1 flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Seu consumo foi alto o suficiente para ultrapassar o teto — parte foi redistribuída entre os outros professores.</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoolFloorCapIndicator;