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

const DeltaBadge = ({ value, suffix = "" }: { value: number | null; suffix?: string }) => {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const cls = value > 0 ? "text-emerald-600" : value < 0 ? "text-destructive" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${cls}`}>
      <Icon className="h-3 w-3" />
      {value >= 0 ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
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
    }
    return closed;
  }, [stats, live]);

  const liveIndex = data.findIndex((d) => d.kind === "live");

  const CustomTooltip = ({ active, payload, label, mode }: any) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0]?.payload;
    if (!row) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-2.5 text-xs shadow-md min-w-[180px]">
        <div className="font-medium mb-1.5">{label}</div>
        {mode === "rf" ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">RF Score</span>
              <span>{row.rf_score?.toFixed(2) ?? "—"}/10</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">vs mês anterior</span>
              <DeltaBadge value={row.d_rf_pct} suffix="%" />
            </div>
            <div className="border-t border-border my-1" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Bônus Qualidade</span>
              <span>{row.quality_bonus_pct?.toFixed(0) ?? "—"}%</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">vs mês anterior</span>
              <DeltaBadge value={row.d_qb_pp} suffix=" p.p." />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Fatia do Pool</span>
              <span>{row.pool_share_pct?.toFixed(2) ?? "—"}%</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">vs mês anterior</span>
              <DeltaBadge value={row.d_share_pp} suffix=" p.p." />
            </div>
            <div className="border-t border-border my-1" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Pool em R$</span>
              <span>{fmtBRL(row.pool_final_amount ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">vs mês anterior</span>
              <DeltaBadge value={row.d_pool_pct} suffix="%" />
            </div>
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