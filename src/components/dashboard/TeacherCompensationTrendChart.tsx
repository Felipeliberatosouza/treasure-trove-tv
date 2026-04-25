import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from "recharts";
import { TrendingUp } from "lucide-react";
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

const TeacherCompensationTrendChart = ({ stats, live }: Props) => {
  const data = useMemo(() => {
    // Closed months (most recent last) — usar últimos 6
    const closed: Array<{
      label: string; period: string;
      rf_score: number | null; quality_bonus_pct: number | null;
      pool_share_pct: number | null; pool_final_amount: number | null;
      kind: "closed" | "live";
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
    return closed;
  }, [stats, live]);

  const liveIndex = data.findIndex((d) => d.kind === "live");

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
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any, name: string) => {
                if (name === "RF Score") return [Number(v).toFixed(2) + "/10", name];
                if (name === "Bônus Qualidade") return [Number(v).toFixed(0) + "%", name];
                return [v, name];
              }}
            />
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
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any, name: string) => {
                if (name === "Fatia do Pool") return [Number(v).toFixed(2) + "%", name];
                if (name === "Pool em R$") return [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0), name];
                return [v, name];
              }}
            />
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

      {liveIndex >= 0 && data.length > 1 && (
        <p className="text-xs text-muted-foreground mt-3">
          O último ponto (•) representa o mês atual em andamento — uma estimativa parcial. Use-o para comparar seu desempenho com o histórico fechado.
        </p>
      )}
    </Card>
  );
};

export default TeacherCompensationTrendChart;