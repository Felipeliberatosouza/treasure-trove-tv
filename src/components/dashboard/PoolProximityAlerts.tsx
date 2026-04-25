import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Info } from "lucide-react";

export interface ProximityAlertsConfig {
  enabled: boolean;
  near_cap_threshold_pct: number;
  near_floor_ratio_pct: number;
  cap_color_hsl: string;
  floor_color_hsl: string;
  near_cap_title: string;
  near_cap_body: string;
  cap_applied_title: string;
  cap_applied_body: string;
  near_floor_title: string;
  near_floor_body: string;
  floor_applied_title: string;
  floor_applied_body: string;
}

export const DEFAULT_PROXIMITY_CFG: ProximityAlertsConfig = {
  enabled: true,
  near_cap_threshold_pct: 80,
  near_floor_ratio_pct: 120,
  cap_color_hsl: "217 91% 60%",
  floor_color_hsl: "38 92% 50%",
  near_cap_title: "Você está próximo do teto ({pct_of_cap}% do limite)",
  near_cap_body:
    "Sua fatia proporcional ({proportional}) está se aproximando do teto de {cap_pct}% do Pool ({cap_value}). Acima desse valor, o consumo extra não aumenta seu repasse.",
  cap_applied_title: "Teto atingido — sua fatia foi limitada a {cap_pct}% do Pool",
  cap_applied_body:
    "Limite atual: {cap_value}. Consumo extra acima disso é redistribuído entre os outros professores.",
  near_floor_title: "Volume baixo — você está perto de acionar o piso mínimo",
  near_floor_body:
    "Seu cálculo proporcional ({proportional}) está apenas {ratio_pct}% acima do piso ({floor_value} = {accesses} acessos × {min_per_access}). Se o consumo cair, o piso será aplicado automaticamente.",
  floor_applied_title: "Piso mínimo acionado — volume baixo neste mês",
  floor_applied_body:
    "Sua fatia proporcional ficou abaixo do piso garantido de {min_per_access} por acesso único ({accesses} acessos = {floor_value}). O piso foi aplicado para proteger sua remuneração.",
};

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
  config?: ProximityAlertsConfig | null;
}

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const isValidHsl = (v: string) => /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test((v || "").trim());

const interpolate = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));

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
  config,
}: PoolProximityAlertsProps) => {
  const cfg: ProximityAlertsConfig = { ...DEFAULT_PROXIMITY_CFG, ...(config ?? {}) };

  if (!cfg.enabled) return null;

  const floorValue = uniqueAccesses * poolMinPerAccess;
  const capValue = poolAmount * (poolMaxSharePct / 100);

  const hasData =
    totalPlatformMinutes != null && totalPlatformMinutes > 0 && proportionalShare != null;

  const capRatio = hasData && capValue > 0 ? (proportionalShare as number) / capValue : 0;
  const floorRatio = hasData && floorValue > 0 ? (proportionalShare as number) / floorValue : 0;

  const NEAR_CAP = (cfg.near_cap_threshold_pct ?? 80) / 100;
  const NEAR_FLOOR = (cfg.near_floor_ratio_pct ?? 120) / 100;

  const capHsl = isValidHsl(cfg.cap_color_hsl) ? cfg.cap_color_hsl : DEFAULT_PROXIMITY_CFG.cap_color_hsl;
  const floorHsl = isValidHsl(cfg.floor_color_hsl) ? cfg.floor_color_hsl : DEFAULT_PROXIMITY_CFG.floor_color_hsl;

  const capStyle: React.CSSProperties = {
    borderColor: `hsl(${capHsl} / 0.4)`,
    background: `hsl(${capHsl} / 0.1)`,
    color: undefined,
  };
  const capAccent: React.CSSProperties = { color: `hsl(${capHsl})` };
  const floorStyle: React.CSSProperties = {
    borderColor: `hsl(${floorHsl} / 0.4)`,
    background: `hsl(${floorHsl} / 0.1)`,
  };
  const floorAccent: React.CSSProperties = { color: `hsl(${floorHsl})` };

  const alerts: Array<{ key: string; node: JSX.Element }> = [];

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

  // CAP
  if (capApplied) {
    const vars = {
      cap_value: formatBRL(capValue),
      cap_pct: poolMaxSharePct,
    };
    alerts.push({
      key: "cap-applied",
      node: (
        <div className="flex items-start gap-2 rounded-md border p-2 text-xs" style={capStyle}>
          <ArrowDownToLine className="h-4 w-4 shrink-0 mt-0.5" style={capAccent} />
          <div className="flex-1">
            <p className="font-medium" style={capAccent}>{interpolate(cfg.cap_applied_title, vars)}</p>
            <p className="text-muted-foreground">{interpolate(cfg.cap_applied_body, vars)}</p>
          </div>
        </div>
      ),
    });
  } else if (hasData && capRatio >= NEAR_CAP && capValue > 0) {
    const pctOfCap = Math.min(capRatio * 100, 99.9);
    const vars = {
      pct_of_cap: pctOfCap.toFixed(0),
      proportional: formatBRL(proportionalShare as number),
      cap_value: formatBRL(capValue),
      cap_pct: poolMaxSharePct,
    };
    alerts.push({
      key: "near-cap",
      node: (
        <div className="flex items-start gap-2 rounded-md border p-2 text-xs" style={capStyle}>
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={capAccent} />
          <div className="flex-1">
            <p className="font-medium" style={capAccent}>{interpolate(cfg.near_cap_title, vars)}</p>
            <p className="text-muted-foreground">{interpolate(cfg.near_cap_body, vars)}</p>
          </div>
        </div>
      ),
    });
  }

  // FLOOR
  if (floorApplied) {
    const vars = {
      accesses: uniqueAccesses,
      min_per_access: formatBRL(poolMinPerAccess),
      floor_value: formatBRL(floorValue),
    };
    alerts.push({
      key: "floor-applied",
      node: (
        <div className="flex items-start gap-2 rounded-md border p-2 text-xs" style={floorStyle}>
          <ArrowUpFromLine className="h-4 w-4 shrink-0 mt-0.5" style={floorAccent} />
          <div className="flex-1">
            <p className="font-medium" style={floorAccent}>{interpolate(cfg.floor_applied_title, vars)}</p>
            <p className="text-muted-foreground">{interpolate(cfg.floor_applied_body, vars)}</p>
          </div>
        </div>
      ),
    });
  } else if (hasData && floorRatio > 0 && floorRatio <= NEAR_FLOOR && uniqueAccesses > 0) {
    const vars = {
      ratio_pct: ((floorRatio - 1) * 100).toFixed(0),
      proportional: formatBRL(proportionalShare as number),
      floor_value: formatBRL(floorValue),
      accesses: uniqueAccesses,
      min_per_access: formatBRL(poolMinPerAccess),
    };
    alerts.push({
      key: "near-floor",
      node: (
        <div className="flex items-start gap-2 rounded-md border p-2 text-xs" style={floorStyle}>
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={floorAccent} />
          <div className="flex-1">
            <p className="font-medium" style={floorAccent}>{interpolate(cfg.near_floor_title, vars)}</p>
            <p className="text-muted-foreground">{interpolate(cfg.near_floor_body, vars)}</p>
          </div>
        </div>
      ),
    });
  } else if (hasData && uniqueAccesses === 0 && totalMinutes > 0) {
    alerts.push({
      key: "no-accesses",
      node: (
        <div className="flex items-start gap-2 rounded-md border p-2 text-xs" style={floorStyle}>
          <Info className="h-4 w-4 shrink-0 mt-0.5" style={floorAccent} />
          <div className="flex-1">
            <p className="font-medium" style={floorAccent}>Sem acessos a materiais ainda</p>
            <p className="text-muted-foreground">
              O piso mínimo é calculado por acesso único a materiais ({formatBRL(poolMinPerAccess)} cada). Sem acessos registrados, não há piso garantido neste mês.
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
