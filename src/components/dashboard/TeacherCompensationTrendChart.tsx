import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from "recharts";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TooltipMessagesConfig,
  TooltipMetricKey,
  DEFAULT_TOOLTIP_MESSAGES,
  TOOLTIP_METRIC_LABELS,
} from "./tooltipMessagesConfig";

interface Stat {
  period_start: string;
  period_end: string;
  rf_score: number | null;
  quality_bonus_pct: number | null;
  pool_share_pct: number | null;
  pool_final_amount: number | null;
}
interface Props {
  stats: Stat[];
  live: any | null;
  tooltipMessages?: TooltipMessagesConfig | null;
}

const monthLabel = (s: string) => {
  try { return format(new Date(s), "MMM/yy", { locale: ptBR }); } catch { return s; }
};

const pctDelta = (curr: number | null | undefined, prev: number | null | undefined): number | null => {
  if (curr == null || prev == null) return null;
  if (prev === 0) {
    if (curr === 0) return 0;
    return null; // variação % indefinida quando base é zero
  }
  return ((curr - prev) / Math.abs(prev)) * 100;
};

const absDelta = (curr: number | null | undefined, prev: number | null | undefined): number | null => {
  if (curr == null || prev == null) return null;
  return curr - prev;
};

const fmtPct = (n: number | null) => n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const DeltaBadge = ({
  value,
  suffix = "",
  metricLabel,
}: {
  value: number | null;
  suffix?: string;
  /** Rótulo da métrica para descrever o delta a leitores de tela. */
  metricLabel?: string;
}) => {
  if (value == null) {
    return (
      <span
        className="text-muted-foreground"
        aria-label={metricLabel ? `${metricLabel}: variação não disponível` : "Variação não disponível"}
      >
        —
      </span>
    );
  }
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  // Contraste reforçado: tons escuros no claro, tons claros no dark — atende WCAG AA sobre bg-card
  const cls =
    value > 0
      ? "text-emerald-700 dark:text-emerald-400"
      : value < 0
      ? "text-red-700 dark:text-red-400"
      : "text-muted-foreground";
  const direction = value > 0 ? "aumentou" : value < 0 ? "diminuiu" : "permaneceu estável";
  const formatted = `${value >= 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;
  const ariaSuffix = suffix.includes("p.p.")
    ? "pontos percentuais"
    : suffix.includes("%")
    ? "por cento"
    : "";
  const aria = metricLabel
    ? `${metricLabel} ${direction} ${Math.abs(value).toFixed(1)} ${ariaSuffix} em relação ao mês anterior`.trim()
    : `Variação: ${direction} ${Math.abs(value).toFixed(1)} ${ariaSuffix}`.trim();
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-medium ${cls}`}
      role="text"
      aria-label={aria}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span aria-hidden="true">{formatted}</span>
    </span>
  );
};

/**
 * Mensagem contextual curta para o tooltip, baseada no sinal e magnitude da variação.
 * @param value valor numérico da variação (em %, p.p. ou /10, dependendo da métrica)
 * @param metric "rf" | "qb" | "share" | "pool" para escolher palavras adequadas
 * @param strongThreshold magnitude absoluta a partir da qual a variação é "expressiva"
 */
const ContextMessage = ({
  value,
  metric,
  config,
}: {
  value: number | null | undefined;
  metric: TooltipMetricKey;
  config: TooltipMessagesConfig;
}) => {
  if (!config.enabled) return null;
  const metricName = TOOLTIP_METRIC_LABELS[metric];
  const m = config[metric];

  if (value == null) {
    return (
      <p
        className="text-[11px] text-muted-foreground italic"
        role="status"
        aria-label={`${metricName}: ${m.no_data}`}
      >
        {m.no_data}
      </p>
    );
  }
  const abs = Math.abs(value);
  if (abs < 0.05) {
    return (
      <p
        className="text-[11px] text-muted-foreground italic"
        role="status"
        aria-label={`${metricName}: ${m.stable}`}
      >
        {m.stable}
      </p>
    );
  }
  const strong = abs >= (m.strong_threshold ?? 0);
  const positive = value > 0;

  const text = positive ? (strong ? m.up_strong : m.up) : strong ? m.down_strong : m.down;
  // Contraste reforçado para WCAG AA sobre bg-card (card claro/dark)
  const cls = positive
    ? "text-emerald-700 dark:text-emerald-300"
    : "text-red-700 dark:text-red-300";
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const directionWord = positive ? (strong ? "Melhorou bastante" : "Melhorou") : (strong ? "Piorou bastante" : "Piorou");
  const aria = `${metricName}: ${directionWord} em relação ao mês anterior. ${text}`;

  return (
    <p
      className={`text-[11px] ${cls} flex items-start gap-1 mt-0.5 font-medium`}
      role="status"
      aria-label={aria}
    >
      <Icon className="h-3 w-3 mt-px shrink-0" aria-hidden="true" />
      {/* Prefixo visual curto com bom contraste, antes do texto descritivo */}
      <span>
        <span className="sr-only">{directionWord}: </span>
        {text}
      </span>
    </p>
  );
};

const TeacherCompensationTrendChart = ({ stats, live, tooltipMessages }: Props) => {
  const ttCfg: TooltipMessagesConfig = useMemo(
    () => ({
      enabled: tooltipMessages?.enabled ?? DEFAULT_TOOLTIP_MESSAGES.enabled,
      rf: { ...DEFAULT_TOOLTIP_MESSAGES.rf, ...(tooltipMessages?.rf ?? {}) },
      qb: { ...DEFAULT_TOOLTIP_MESSAGES.qb, ...(tooltipMessages?.qb ?? {}) },
      share: { ...DEFAULT_TOOLTIP_MESSAGES.share, ...(tooltipMessages?.share ?? {}) },
      pool: { ...DEFAULT_TOOLTIP_MESSAGES.pool, ...(tooltipMessages?.pool ?? {}) },
    }),
    [tooltipMessages]
  );
  const data = useMemo(() => {
    // Closed months (most recent last) — usar últimos 6
    const closed: Array<{
      label: string; period: string;
      rf_score: number | null; quality_bonus_pct: number | null;
      pool_share_pct: number | null; pool_final_amount: number | null;
      kind: "closed" | "live";
      d_rf_pct?: number | null; d_qb_pct?: number | null; d_share_pct?: number | null; d_pool_pct?: number | null;
      d_qb_pp?: number | null; d_share_pp?: number | null; d_rf_abs?: number | null;
      prev_label?: string | null;
      prev_rf_score?: number | null;
      prev_quality_bonus_pct?: number | null;
      prev_pool_share_pct?: number | null;
      prev_pool_final_amount?: number | null;
    }> = [...stats]
      .filter((s) => s.period_start)
      .sort((a, b) => a.period_start.localeCompare(b.period_start))
      .slice(-6)
      .map((s) => ({
        label: monthLabel(s.period_start),
        period: s.period_start,
        rf_score: s.rf_score != null ? Number(s.rf_score) : null,
        quality_bonus_pct: s.quality_bonus_pct != null ? Number(s.quality_bonus_pct) : null,
        pool_share_pct: s.pool_share_pct != null ? Number(s.pool_share_pct) : null,
        pool_final_amount: s.pool_final_amount != null ? Number(s.pool_final_amount) : null,
        kind: "closed",
      }));
    if (live) {
      closed.push({
        label: `${monthLabel(live.period.start)} (parcial)`,
        period: live.period.start,
        rf_score: Number(live.rf_score ?? 0),
        quality_bonus_pct: Number(live.quality_bonus_pct ?? 0),
        pool_share_pct: Number(live.pool_share_pct ?? 0),
        pool_final_amount: Number(live.pool_final_amount ?? 0),
        kind: "live",
      });
    }
    // Calcular deltas vs mês anterior
    for (let i = 0; i < closed.length; i++) {
      const prev = i > 0 ? closed[i - 1] : null;
      const curr = closed[i];
      curr.d_rf_pct = pctDelta(curr.rf_score, prev?.rf_score);
      curr.d_rf_abs = absDelta(curr.rf_score, prev?.rf_score);
      curr.d_qb_pct = pctDelta(curr.quality_bonus_pct, prev?.quality_bonus_pct);
      curr.d_qb_pp = absDelta(curr.quality_bonus_pct, prev?.quality_bonus_pct);
      curr.d_share_pct = pctDelta(curr.pool_share_pct, prev?.pool_share_pct);
      curr.d_share_pp = absDelta(curr.pool_share_pct, prev?.pool_share_pct);
      curr.d_pool_pct = pctDelta(curr.pool_final_amount, prev?.pool_final_amount);
      curr.prev_label = prev?.label ?? null;
      curr.prev_rf_score = prev?.rf_score ?? null;
      curr.prev_quality_bonus_pct = prev?.quality_bonus_pct ?? null;
      curr.prev_pool_share_pct = prev?.pool_share_pct ?? null;
      curr.prev_pool_final_amount = prev?.pool_final_amount ?? null;
    }
    return closed;
  }, [stats, live]);

  const liveIndex = data.findIndex((d) => d.kind === "live");

  const CustomTooltip = ({ active, payload, label, mode }: any) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0]?.payload;
    if (!row) return null;
    const prevLabel = row.prev_label ?? "mês anterior";
    return (
      <div className="rounded-lg border border-border bg-card p-2.5 text-xs shadow-md min-w-[240px] max-w-[280px]">
        <div className="font-medium mb-1.5">{label}</div>
        {mode === "rf" ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">RF Score</span>
              <span>{row.rf_score?.toFixed(2) ?? "—"}/10</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{prevLabel}</span>
              <span>{row.prev_rf_score != null ? `${Number(row.prev_rf_score).toFixed(2)}/10` : "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Variação</span>
              <DeltaBadge value={row.d_rf_pct} suffix="%" metricLabel="RF Score" />
            </div>
            <ContextMessage value={row.d_rf_pct} metric="rf" config={ttCfg} />
            <div className="border-t border-border my-1" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Bônus Qualidade</span>
              <span>{row.quality_bonus_pct?.toFixed(0) ?? "—"}%</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{prevLabel}</span>
              <span>{row.prev_quality_bonus_pct != null ? `${Number(row.prev_quality_bonus_pct).toFixed(0)}%` : "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Variação</span>
              <DeltaBadge value={row.d_qb_pp} suffix=" p.p." metricLabel="Bônus de Qualidade" />
            </div>
            <ContextMessage value={row.d_qb_pp} metric="qb" config={ttCfg} />
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Fatia do Pool</span>
              <span>{row.pool_share_pct?.toFixed(2) ?? "—"}%</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{prevLabel}</span>
              <span>{row.prev_pool_share_pct != null ? `${Number(row.prev_pool_share_pct).toFixed(2)}%` : "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Variação</span>
              <DeltaBadge value={row.d_share_pp} suffix=" p.p." metricLabel="Fatia do Pool" />
            </div>
            <ContextMessage value={row.d_share_pp} metric="share" config={ttCfg} />
            <div className="border-t border-border my-1" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Pool em R$</span>
              <span>{fmtBRL(row.pool_final_amount ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{prevLabel}</span>
              <span>{row.prev_pool_final_amount != null ? fmtBRL(Number(row.prev_pool_final_amount)) : "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Variação</span>
              <DeltaBadge value={row.d_pool_pct} suffix="%" metricLabel="Pool em R$" />
            </div>
            <ContextMessage value={row.d_pool_pct} metric="pool" config={ttCfg} />
          </div>
        )}
      </div>
    );
  };

  // Mini resumo: variação do último ponto (parcial se houver, senão último fechado) vs anterior
  const summary = useMemo(() => {
    if (data.length < 2) return null;
    const last = data[data.length - 1];
    return {
      label: last.label,
      isLive: last.kind === "live",
      rf: last.d_rf_pct,
      qb: last.d_qb_pp, // variação em pontos percentuais (mais natural para o bônus)
      share: last.d_share_pp,
      pool: last.d_pool_pct,
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <Card className="p-6 mb-6">
        <h3 className="font-medium flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-primary" /> Evolução mensal</h3>
        <p className="text-sm text-muted-foreground">Sem histórico suficiente para exibir o gráfico de tendência.</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Evolução mensal</h3>
          <p className="text-xs text-muted-foreground">Histórico dos últimos meses fechados, com o mês atual (parcial) destacado para comparação.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="secondary">Fechado</Badge>
          <Badge variant="default">Mês atual (parcial)</Badge>
        </div>
      </div>

      {/* RF Score & Quality Bonus (eixo 0–10 e 0–20%) */}
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" domain={[0, 10]} tick={{ fontSize: 11 }} label={{ value: "RF /10", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 20]} tick={{ fontSize: 11 }} label={{ value: "Bônus %", angle: 90, position: "insideRight", style: { fontSize: 10 } }} />
            <Tooltip content={<CustomTooltip mode="rf" />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line yAxisId="left" type="monotone" dataKey="rf_score" name="RF Score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line yAxisId="right" type="monotone" dataKey="quality_bonus_pct" name="Bônus Qualidade" stroke="hsl(var(--accent-foreground))" strokeDasharray="4 4" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            {liveIndex >= 0 && (
              <>
                <ReferenceDot yAxisId="left" x={data[liveIndex].label} y={data[liveIndex].rf_score ?? 0} r={6} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2} />
                <ReferenceDot yAxisId="right" x={data[liveIndex].label} y={data[liveIndex].quality_bonus_pct ?? 0} r={6} fill="hsl(var(--accent-foreground))" stroke="hsl(var(--background))" strokeWidth={2} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pool share % & Pool R$ */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: "Fatia %", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: "R$", angle: 90, position: "insideRight", style: { fontSize: 10 } }} />
            <Tooltip content={<CustomTooltip mode="pool" />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line yAxisId="left" type="monotone" dataKey="pool_share_pct" name="Fatia do Pool" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line yAxisId="right" type="monotone" dataKey="pool_final_amount" name="Pool em R$" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            {liveIndex >= 0 && (
              <>
                <ReferenceDot yAxisId="left" x={data[liveIndex].label} y={data[liveIndex].pool_share_pct ?? 0} r={6} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2} />
                <ReferenceDot yAxisId="right" x={data[liveIndex].label} y={data[liveIndex].pool_final_amount ?? 0} r={6} fill="hsl(142 76% 36%)" stroke="hsl(var(--background))" strokeWidth={2} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {summary && (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <p className="text-xs font-medium">
              Variação de <span className="text-foreground">{summary.label}</span> vs mês anterior
            </p>
            {summary.isLive && (
              <Badge variant="outline" className="text-[10px]">Estimativa parcial</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-md bg-card border border-border p-2">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">RF Score</div>
              <DeltaBadge value={summary.rf} suffix="%" metricLabel="RF Score" />
            </div>
            <div className="rounded-md bg-card border border-border p-2">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Bônus Qualidade</div>
              <DeltaBadge value={summary.qb} suffix=" p.p." metricLabel="Bônus de Qualidade" />
            </div>
            <div className="rounded-md bg-card border border-border p-2">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Fatia do Pool</div>
              <DeltaBadge value={summary.share} suffix=" p.p." metricLabel="Fatia do Pool" />
            </div>
            <div className="rounded-md bg-card border border-border p-2">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Pool em R$</div>
              <DeltaBadge value={summary.pool} suffix="%" metricLabel="Pool em R$" />
            </div>
          </div>
          {liveIndex >= 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              O último ponto (•) é o mês atual em andamento — comparação contra o último mês fechado.
            </p>
          )}
        </div>
      )}

      {/* Resumo em texto — alternativa acessível ao gráfico/tooltip */}
      {data.length > 0 && (
        <section
          aria-label="Resumo em texto da evolução mensal"
          className="mt-4 rounded-lg border border-border bg-card p-3"
        >
          <header className="mb-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
              Resumo em texto
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Versão legível por leitor de tela e mais clara em telas pequenas — valores absolutos e direção da variação para cada mês.
            </p>
          </header>
          <ul className="space-y-3" role="list">
            {[...data].reverse().map((row) => {
              const describe = (
                label: string,
                curr: number | null | undefined,
                prev: number | null | undefined,
                delta: number | null | undefined,
                fmtCurr: (n: number) => string,
                deltaSuffix: string,
              ) => {
                const currTxt = curr != null ? fmtCurr(curr) : "—";
                const prevTxt = prev != null ? fmtCurr(prev) : "—";
                let dir: "up" | "down" | "flat" | "na" = "na";
                if (delta != null) dir = delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat";
                const dirWord =
                  dir === "up" ? "subiu" : dir === "down" ? "caiu" : dir === "flat" ? "estável" : "sem comparação";
                const deltaTxt =
                  delta == null
                    ? "—"
                    : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}${deltaSuffix}`;
                const cls =
                  dir === "up"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : dir === "down"
                    ? "text-red-700 dark:text-red-400"
                    : "text-muted-foreground";
                const Icon =
                  dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
                const aria =
                  delta == null
                    ? `${label}: ${currTxt}. Sem mês anterior para comparação.`
                    : `${label}: ${currTxt}. ${dirWord} ${Math.abs(delta).toFixed(1)}${
                        deltaSuffix.includes("p.p.")
                          ? " pontos percentuais"
                          : deltaSuffix.includes("%")
                          ? " por cento"
                          : ""
                      } em relação a ${row.prev_label ?? "mês anterior"} (${prevTxt}).`;
                return (
                  <li
                    key={label}
                    className="flex items-start justify-between gap-3 text-xs"
                    aria-label={aria}
                  >
                    <span className="text-muted-foreground shrink-0">{label}</span>
                    <span className="text-right">
                      <span className="font-medium text-foreground" aria-hidden="true">
                        {currTxt}
                      </span>
                      <span className="text-muted-foreground" aria-hidden="true">
                        {" "}
                        (anterior: {prevTxt})
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 ml-2 font-medium ${cls}`}
                        aria-hidden="true"
                      >
                        <Icon className="h-3 w-3" />
                        {deltaTxt}
                      </span>
                    </span>
                  </li>
                );
              };
              return (
                <li key={row.period} className="border-b border-border last:border-b-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                    <h5 className="text-xs font-semibold">
                      {row.label}
                      {row.prev_label && (
                        <span className="font-normal text-muted-foreground"> · vs {row.prev_label}</span>
                      )}
                    </h5>
                    {row.kind === "live" && (
                      <Badge variant="outline" className="text-[10px]">Parcial</Badge>
                    )}
                  </div>
                  <ul className="space-y-1" role="list">
                    {describe(
                      "RF Score",
                      row.rf_score,
                      row.prev_rf_score,
                      row.d_rf_pct,
                      (n) => `${n.toFixed(2)}/10`,
                      "%",
                    )}
                    {describe(
                      "Bônus Qualidade",
                      row.quality_bonus_pct,
                      row.prev_quality_bonus_pct,
                      row.d_qb_pp,
                      (n) => `${n.toFixed(0)}%`,
                      " p.p.",
                    )}
                    {describe(
                      "Fatia do Pool",
                      row.pool_share_pct,
                      row.prev_pool_share_pct,
                      row.d_share_pp,
                      (n) => `${n.toFixed(2)}%`,
                      " p.p.",
                    )}
                    {describe(
                      "Pool em R$",
                      row.pool_final_amount,
                      row.prev_pool_final_amount,
                      row.d_pool_pct,
                      (n) => fmtBRL(n),
                      "%",
                    )}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Card>
  );
};

export default TeacherCompensationTrendChart;