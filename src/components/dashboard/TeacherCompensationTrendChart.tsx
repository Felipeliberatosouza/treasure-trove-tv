import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from "recharts";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
const METRIC_LABELS: Record<"rf" | "qb" | "share" | "pool", string> = {
  rf: "RF Score",
  qb: "Bônus de Qualidade",
  share: "Fatia do Pool",
  pool: "Pool em R$",
};

const ContextMessage = ({
  value,
  metric,
  strongThreshold,
}: {
  value: number | null | undefined;
  metric: "rf" | "qb" | "share" | "pool";
  strongThreshold: number;
}) => {
  const metricName = METRIC_LABELS[metric];

  if (value == null) {
    return (
      <p
        className="text-[11px] text-muted-foreground italic"
        role="status"
        aria-label={`${metricName}: sem comparação disponível com o mês anterior.`}
      >
        Sem comparação disponível com o mês anterior.
      </p>
    );
  }
  const abs = Math.abs(value);
  if (abs < 0.05) {
    return (
      <p
        className="text-[11px] text-muted-foreground italic"
        role="status"
        aria-label={`${metricName}: estável em relação ao mês anterior, sem variação relevante.`}
      >
        Estável vs mês anterior — sem variação relevante.
      </p>
    );
  }
  const strong = abs >= strongThreshold;
  const positive = value > 0;

  const msgs: Record<typeof metric, { up: string; upStrong: string; down: string; downStrong: string }> = {
    rf: {
      up: "Seu RF Score melhorou vs mês anterior — bom ritmo de entregas.",
      upStrong: "Salto importante no RF Score! Continue mantendo o engajamento.",
      down: "Seu RF Score caiu um pouco — atenção às metas do mês.",
      downStrong: "Queda expressiva no RF Score — revise inserções, aulas e dúvidas em aberto.",
    },
    qb: {
      up: "Bônus de Qualidade subiu — alunos avaliaram melhor seus conteúdos.",
      upStrong: "Forte aumento no Bônus de Qualidade — excelente recepção dos alunos!",
      down: "Bônus de Qualidade reduziu — fique de olho nas avaliações recentes.",
      downStrong: "Queda forte no Bônus de Qualidade — vale revisar feedbacks dos alunos.",
    },
    share: {
      up: "Sua fatia do Pool aumentou — você ganhou espaço relativo na plataforma.",
      upStrong: "Grande ganho de fatia do Pool — seu conteúdo cresceu bem em relação aos outros.",
      down: "Sua fatia do Pool diminuiu — outros professores cresceram mais este mês.",
      downStrong: "Queda significativa de fatia — consumo do seu conteúdo perdeu peso relativo.",
    },
    pool: {
      up: "Pool em R$ melhorou vs mês anterior.",
      upStrong: "Pool em R$ teve forte alta — combinação de mais consumo e/ou melhores bônus.",
      down: "Pool em R$ ficou abaixo do mês anterior.",
      downStrong: "Queda expressiva no Pool em R$ — confira piso/teto e seu RF Score.",
    },
  };

  const dict = msgs[metric];
  const text = positive ? (strong ? dict.upStrong : dict.up) : strong ? dict.downStrong : dict.down;
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

const TeacherCompensationTrendChart = ({ stats, live }: Props) => {
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
              <DeltaBadge value={row.d_rf_pct} suffix="%" />
            </div>
            <ContextMessage value={row.d_rf_pct} metric="rf" strongThreshold={10} />
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
              <DeltaBadge value={row.d_qb_pp} suffix=" p.p." />
            </div>
            <ContextMessage value={row.d_qb_pp} metric="qb" strongThreshold={5} />
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
              <DeltaBadge value={row.d_share_pp} suffix=" p.p." />
            </div>
            <ContextMessage value={row.d_share_pp} metric="share" strongThreshold={2} />
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
              <DeltaBadge value={row.d_pool_pct} suffix="%" />
            </div>
            <ContextMessage value={row.d_pool_pct} metric="pool" strongThreshold={20} />
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
              <DeltaBadge value={summary.rf} suffix="%" />
            </div>
            <div className="rounded-md bg-card border border-border p-2">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Bônus Qualidade</div>
              <DeltaBadge value={summary.qb} suffix=" p.p." />
            </div>
            <div className="rounded-md bg-card border border-border p-2">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Fatia do Pool</div>
              <DeltaBadge value={summary.share} suffix=" p.p." />
            </div>
            <div className="rounded-md bg-card border border-border p-2">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Pool em R$</div>
              <DeltaBadge value={summary.pool} suffix="%" />
            </div>
          </div>
          {liveIndex >= 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              O último ponto (•) é o mês atual em andamento — comparação contra o último mês fechado.
            </p>
          )}
        </div>
      )}
    </Card>
  );
};

export default TeacherCompensationTrendChart;