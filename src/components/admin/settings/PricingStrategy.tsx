import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, TrendingUp, Calculator } from "lucide-react";
import { toast } from "sonner";

type Area = "revisoes" | "trabalhos" | "atendente" | "provas_reais";

/** Custo relativo de cada modelo em comparação ao GPT-6 Astra (1 = mesmo custo). */
const MODEL_FACTOR: Record<string, { label: string; f: number }> = {
  "openai/gpt-6-astra": { label: "GPT-6 Astra", f: 1 },
  "openai/gpt-6-sol": { label: "GPT-6 Sol", f: 0.5 },
  "openai/gpt-6-luna": { label: "GPT-6 Luna", f: 0.2 },
  "google/gemini-3.1-pro-preview": { label: "Gemini 3.1 Pro", f: 0.9 },
  "google/gemini-3.8-flash": { label: "Gemini 3.8 Flash", f: 0.25 },
  "google/gemini-3.1-flash-lite": { label: "Gemini 3.1 Flash Lite", f: 0.1 },
};
const DEFAULT_MODEL = "openai/gpt-6-astra";

type Feature = {
  key: string; name: string; area: Area; products: string[];
  text: number; voice: number; voiceFallback: number; extra: number; extraLabel?: string;
  credits: number; price: number;
};

const ALL_EXAM = ["provas", "enem", "vestibulares", "oab", "concursos"];

/** Levantamento de custos com fornecedores (R$ por uso), com o modelo GPT-6 Astra e voz ElevenLabs. */
const FEATURES: Feature[] = [
  { key: "trabalho_geracao", name: "Trabalhos: geração (Word + Slides)", area: "trabalhos", products: ["trabalhos"], text: 0.35, voice: 0, voiceFallback: 0, extra: 0, credits: 2, price: 4.9 },
  { key: "trabalho_interacao", name: "Trabalhos: interação de ajuste", area: "trabalhos", products: ["trabalhos"], text: 0.12, voice: 0, voiceFallback: 0, extra: 0, credits: 1, price: 1.9 },
  { key: "revisao_aula", name: "Revisão: Aula com Professor Virtual", area: "revisoes", products: ALL_EXAM, text: 0.4, voice: 1.25, voiceFallback: 0.35, extra: 0.55, extraLabel: "imagens", credits: 5, price: 9.9 },
  { key: "video_neural", name: "Vídeo especial com professor real (D-ID)", area: "revisoes", products: ALL_EXAM, text: 0, voice: 1.25, voiceFallback: 0.35, extra: 3.55, extraLabel: "vídeo D-ID", credits: 10, price: 19.9 },
  { key: "resumo", name: "Resumos", area: "revisoes", products: ALL_EXAM, text: 0.1, voice: 0, voiceFallback: 0, extra: 0, credits: 1, price: 3.9 },
  { key: "simulado", name: "Simulados e correção de redação", area: "provas_reais", products: ALL_EXAM, text: 0.4, voice: 0, voiceFallback: 0, extra: 0, credits: 3, price: 6.9 },
  { key: "top_questoes", name: "Top Questões comentadas", area: "revisoes", products: ALL_EXAM, text: 0.15, voice: 0, voiceFallback: 0, extra: 0, credits: 2, price: 4.5 },
  { key: "colinha", name: "Colinhas", area: "revisoes", products: ALL_EXAM, text: 0.08, voice: 0, voiceFallback: 0, extra: 0, credits: 1, price: 2.9 },
  { key: "foto", name: "Análise de foto (questão ou tema)", area: "revisoes", products: ALL_EXAM, text: 0.14, voice: 0, voiceFallback: 0, extra: 0, credits: 1, price: 2.9 },
  { key: "duvida_ia", name: "Dúvidas com Professor Virtual", area: "atendente", products: [...ALL_EXAM, "trabalhos"], text: 0.06, voice: 0, voiceFallback: 0, extra: 0, credits: 1, price: 1.5 },
];

const PRODUCTS = [
  { key: "provas", name: "Provas" }, { key: "trabalhos", name: "Trabalhos" }, { key: "enem", name: "ENEM" },
  { key: "vestibulares", name: "Vestibulares" }, { key: "oab", name: "OAB" }, { key: "concursos", name: "Concursos" },
];

type Override = { text?: number; voice?: number; extra?: number; credits?: number; price?: number };
type Strategy = { features: Record<string, Override>; expenses: Record<string, number> };

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PricingStrategy() {
  const [models, setModels] = useState<Record<string, string>>({});
  const [voiceProvider, setVoiceProvider] = useState("openai");
  const [teacher, setTeacher] = useState<{ resource_type: string; price: number; platform_percentage: number }[]>([]);
  const [st, setSt] = useState<Strategy>({ features: {}, expenses: {} });
  const [saving, setSaving] = useState(false);
  // Valores reais cobrados hoje nos Trabalhos (lidos pela cobrança em work-document).
  const [wdp, setWdp] = useState<Record<string, number> | null>(null);

  const loadLive = useCallback(async () => {
    const [{ data: s }, { data: rp }] = await Promise.all([
      supabase.from("platform_settings").select("key, value").in("key", ["ai_models_config", "ai_voice_config"]),
      supabase.from("resource_prices").select("resource_type, price, platform_percentage").in("resource_type", ["revisoes", "aula_particular"]),
    ]);
    (s || []).forEach((r: any) => {
      if (r.key === "ai_models_config") setModels(r.value || {});
      if (r.key === "ai_voice_config") setVoiceProvider(r.value?.provider || "openai");
    });
    setTeacher((rp || []) as any);
  }, []);

  useEffect(() => {
    void loadLive();
    supabase.from("platform_settings").select("value").eq("key", "pricing_strategy").maybeSingle().then(({ data }) => {
      if (data?.value) setSt({ features: {}, expenses: {}, ...(data.value as any) });
    });
    supabase.from("platform_settings").select("value").eq("key", "work_documents_pricing").maybeSingle().then(({ data }) => {
      setWdp((data?.value as any) || {});
    });
    // Atualização automática quando fornecedores de IA, voz ou repasses de professores mudam.
    const ch = supabase
      .channel("pricing-strategy")
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_settings" }, (p: any) => {
        const k = p.new?.key || p.old?.key;
        if (k === "ai_models_config" || k === "ai_voice_config") void loadLive();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "resource_prices" }, () => void loadLive())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadLive]);

  const rows = useMemo(() => FEATURES.map((f) => {
    const real = wdp && (f.key === "trabalho_geracao" || f.key === "trabalho_interacao")
      ? (f.key === "trabalho_geracao"
        ? { credits: wdp.credits_generation, price: wdp.price_generation }
        : { credits: wdp.credits_interaction, price: wdp.price_interaction })
      : {};
    const base = { ...f, credits: Number(real.credits ?? f.credits), price: Number(real.price ?? f.price) };
    const o = st.features[f.key] || {};
    const modelId = models[f.area] || DEFAULT_MODEL;
    const m = MODEL_FACTOR[modelId] || { label: modelId, f: 1 };
    const eleven = voiceProvider === "elevenlabs";
    const text = (o.text ?? f.text) * m.f;
    const voice = f.voice ? (eleven ? (o.voice ?? f.voice) : f.voiceFallback) : 0;
    const extra = o.extra ?? f.extra;
    const cost = text + voice + extra;
    const price = o.price ?? base.price;
    const margin = price - cost;
    const supplier = [f.text ? m.label : null, f.voice ? (eleven ? "ElevenLabs" : "Voz OpenAI") : null, f.extraLabel || null].filter(Boolean).join(" + ");
    return { ...f, supplier, baseText: o.text ?? f.text, cost, price, credits: o.credits ?? base.credits, margin, pct: price > 0 ? (margin / price) * 100 : 0 };
  }), [st, models, voiceProvider, wdp]);

  const teacherRows = teacher.map((t) => {
    const platform = (Number(t.price) * Number(t.platform_percentage)) / 100;
    return { name: t.resource_type === "aula_particular" ? "Aula Particular (50 min)" : "Aulas Gravadas por Professor", price: Number(t.price), cost: Number(t.price) - platform, margin: platform, pct: Number(t.platform_percentage) };
  });

  const setF = (key: string, patch: Override) => setSt((s) => ({ ...s, features: { ...s.features, [key]: { ...s.features[key], ...patch } } }));

  const breakEven = PRODUCTS.map((p) => {
    const list = rows.filter((r) => r.products.includes(p.key));
    const avgMargin = list.length ? list.reduce((a, r) => a + r.margin, 0) / list.length : 0;
    const avgPrice = list.length ? list.reduce((a, r) => a + r.price, 0) / list.length : 0;
    const exp = st.expenses[p.key] || 0;
    const units = avgMargin > 0 ? Math.ceil(exp / avgMargin) : null;
    return { ...p, exp, avgMargin, units, revenue: units != null ? units * avgPrice : null };
  });

  const save = async () => {
    if (!wdp) { toast.error("Aguarde carregar os preços atuais dos Trabalhos."); return; }
    setSaving(true);
    const w = (k: string) => rows.find((r) => r.key === k)!;
    const g = w("trabalho_geracao"), it = w("trabalho_interacao");
    const [a, b] = await Promise.all([
      supabase.from("platform_settings").upsert({ key: "pricing_strategy", value: st as any }, { onConflict: "key" }),
      // Mantém a cobrança real dos Trabalhos alinhada com esta tela.
      supabase.from("platform_settings").upsert({ key: "work_documents_pricing", value: {
        ...wdp,
        credits_generation: g.credits, credits_interaction: it.credits,
        provider_cost_generation: Number(g.cost.toFixed(2)), provider_cost_interaction: Number(it.cost.toFixed(2)),
        price_generation: g.price, price_interaction: it.price,
      } as any }, { onConflict: "key" }),
    ]);
    setSaving(false);
    if (a.error || b.error) toast.error("Não foi possível salvar."); else toast.success("Estratégia de preços salva.");
  };

  const marginCell = (m: number, pct: number) => (
    <span className={m >= 0 ? "font-semibold text-success" : "font-semibold text-destructive"}>{money(m)} ({pct.toFixed(0)}%)</span>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold"><TrendingUp className="h-5 w-5" /> Estratégia de Preços</h2>
        <p className="text-sm text-muted-foreground">
          Custo, preço e margem de cada recurso de todos os produtos. O custo se atualiza sozinho quando você troca a IA de uma área ou a voz em Gestão de IA, e quando muda o repasse dos professores.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Recurso</TableHead>
              <TableHead>Fornecedor ativo</TableHead>
              <TableHead className="min-w-[130px]">Custo de referência da IA (GPT-6 Astra)</TableHead>
              <TableHead className="min-w-[110px]">Custo real por uso (com a IA ativa)</TableHead>
              <TableHead className="min-w-[90px]">Créditos cobrados do aluno</TableHead>
              <TableHead className="min-w-[130px]">Preço de venda ao aluno</TableHead>
              <TableHead className="min-w-[140px]">Margem por uso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="text-sm">{r.name}</TableCell>
                <TableCell><Badge variant="secondary" className="whitespace-nowrap text-xs">{r.supplier}</Badge></TableCell>
                <TableCell>{r.text ? <CurrencyInput prefix="R$" className="h-9 min-w-[110px]" value={r.baseText} onValueChange={(v) => setF(r.key, { text: v })} /> : <span className="text-sm text-muted-foreground">R$ 0</span>}</TableCell>
                <TableCell className="whitespace-nowrap text-sm font-medium">{money(r.cost)}</TableCell>
                <TableCell><Input type="number" min={0} className="h-9 min-w-[70px]" value={r.credits} onChange={(e) => setF(r.key, { credits: parseInt(e.target.value, 10) || 0 })} /></TableCell>
                <TableCell><CurrencyInput prefix="R$" className="h-9 min-w-[110px]" value={r.price} onValueChange={(v) => setF(r.key, { price: v })} /></TableCell>
                <TableCell className="whitespace-nowrap text-sm">{marginCell(r.margin, r.pct)}</TableCell>
              </TableRow>
            ))}
            {teacherRows.map((t) => (
              <TableRow key={t.name}>
                <TableCell className="text-sm">{t.name}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">Repasse ao professor</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                <TableCell className="whitespace-nowrap text-sm font-medium">{money(t.cost)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{money(t.price)}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{marginCell(t.margin, t.pct)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p><strong>Custo de referência da IA:</strong> quanto custa o texto gerado por uso com o GPT-6 Astra. É o número que você ajusta.</p>
        <p><strong>Custo real por uso:</strong> o que a plataforma paga de fato hoje, já somando a IA ativa da área, a voz e imagens/vídeo. Se a IA ativa for mais barata, este valor cai sozinho.</p>
        <p><strong>Créditos cobrados do aluno:</strong> quantos Créditos de IA o aluno gasta por uso. Não multiplica o custo — o custo é sempre por uso.</p>
        <p><strong>Atenção:</strong> só os créditos e preços dos Trabalhos são cobrados de fato a partir desta tela. Nos demais recursos, créditos e preço são uma simulação para planejamento — o preço real das aulas fica em "Preço de Recursos Individuais" logo abaixo.</p>
        <p>Todos os valores já estão em reais (R$).</p>
      </div>

      <div>
        <h3 className="mb-1 flex items-center gap-2 font-display text-base font-semibold"><Calculator className="h-4 w-4" /> Custos e despesas do negócio e ponto de equilíbrio</h3>
        <p className="mb-3 text-sm text-muted-foreground">Informe as despesas mensais de cada produto (marketing, servidores, equipe, rateios). O sistema mostra quantas vendas por mês cobrem essas despesas, usando a margem média dos recursos do produto.</p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {breakEven.map((b) => (
            <Card key={b.key}>
              <CardContent className="space-y-2 p-4">
                <p className="font-semibold">{b.name}</p>
                <label className="block text-xs text-muted-foreground">Custos e despesas por mês (R$)</label>
                <CurrencyInput className="h-9" value={b.exp} onValueChange={(v) => setSt((s) => ({ ...s, expenses: { ...s.expenses, [b.key]: v } }))} />
                <p className="text-sm">Margem média por venda: <strong>{money(b.avgMargin)}</strong></p>
                <p className="text-sm">Ponto de equilíbrio: <strong>{b.units == null ? "margem negativa" : `${b.units.toLocaleString("pt-BR")} vendas/mês`}</strong></p>
                {b.revenue != null && <p className="text-xs text-muted-foreground">Faturamento mínimo: {money(b.revenue)}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? "Salvando..." : "Salvar estratégia de preços"}</Button>
    </div>
  );
}
