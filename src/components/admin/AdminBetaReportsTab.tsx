import { useCallback, useEffect, useMemo, useState } from "react";
import { Bug, Bot, User, Loader2, Gift, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBetaMode, saveBetaMode } from "@/hooks/useBetaMode";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

type Report = {
  id: string;
  user_id: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  origin: "usuario" | "automatico";
  page_url: string | null;
  description: string | null;
  error_message: string | null;
  stack_trace: string | null;
  error_kind: string | null;
  browser_info: Record<string, unknown>;
  status: string;
  admin_notes: string | null;
  reward_credits: number;
  reward_granted_at: string | null;
  created_at: string;
};

const STATUS: Record<string, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  resolvido: "Resolvido",
  descartado: "Descartado",
};
const KIND: Record<string, string> = {
  erro_javascript: "Erro na tela",
  promessa_rejeitada: "Falha em ação",
  console_error: "Erro registrado",
  falha_servidor: "Falha no servidor",
};

export default function AdminBetaReportsTab() {
  const { settings } = useBetaMode();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [reward, setReward] = useState(settings.reward_credits);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState<"todos" | "usuario" | "automatico">("todos");
  const [status, setStatus] = useState<string>("pendente");
  const [open, setOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [grant, setGrant] = useState<Record<string, number>>({});

  useEffect(() => {
    setEnabled(settings.enabled);
    setReward(settings.reward_credits);
  }, [settings.enabled, settings.reward_credits]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("beta_bug_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setReports((data ?? []) as Report[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const saveFlag = async (next: boolean) => {
    setEnabled(next);
    const err = await saveBetaMode({ enabled: next, reward_credits: reward });
    if (err) { toast.error("Não foi possível salvar."); setEnabled(!next); return; }
    toast.success(next ? "Versão Beta ativada." : "Versão Beta desativada.");
  };

  const filtered = useMemo(
    () => reports.filter((r) => (origin === "todos" || r.origin === origin) && (status === "todos" || r.status === status)),
    [reports, origin, status],
  );
  const counts = useMemo(() => ({
    pendUser: reports.filter((r) => r.origin === "usuario" && r.status === "pendente").length,
    pendAuto: reports.filter((r) => r.origin === "automatico" && r.status === "pendente").length,
  }), [reports]);

  const update = async (r: Report, patch: Partial<Report>) => {
    const { error } = await supabase.from("beta_bug_reports").update(patch).eq("id", r.id);
    if (error) return toast.error("Não foi possível atualizar.");
    setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
    toast.success("Reporte atualizado.");
  };

  const giveReward = async (r: Report) => {
    const qty = grant[r.id] ?? reward;
    const { error } = await supabase.rpc("grant_bug_report_reward", { _report_id: r.id, _credits: qty });
    if (error) return toast.error(error.message);
    toast.success(`${qty} Créditos de IA concedidos.`);
    void load();
  };

  const exportCsv = () => {
    const head = ["Data", "Origem", "Status", "Usuário", "E-mail", "Página", "Descrição", "Erro", "Tipo", "Navegador", "Créditos"];
    const rows = filtered.map((r) => [
      new Date(r.created_at).toLocaleString("pt-BR"), r.origin === "usuario" ? "Usuário" : "Automático", STATUS[r.status],
      r.reporter_name ?? "", r.reporter_email ?? "", r.page_url ?? "", r.description ?? "", r.error_message ?? "",
      KIND[r.error_kind ?? ""] ?? "", String(r.browser_info?.userAgent ?? ""), String(r.reward_credits),
    ]);
    const csv = "\uFEFF" + [head, ...rows].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "reportes-versao-beta.csv";
    a.click();
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Versão Beta</h2>
            <p className="text-sm text-muted-foreground">
              Quando ativa: barra fixa com "Reportar ERROS", conteúdos liberados gratuitamente, avisos nos planos,
              cartão de teste fixo no pagamento (sem cobrança) e detecção automática de erros.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={saveFlag} aria-label="Ativar Versão Beta" />
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label htmlFor="beta-reward">Créditos de IA sugeridos por reporte válido</Label>
            <Input id="beta-reward" type="number" min={1} max={1000} className="w-32" value={reward}
              onChange={(e) => setReward(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <Button variant="outline" onClick={() => saveBetaMode({ enabled, reward_credits: reward }).then((e) => e ? toast.error("Erro ao salvar") : toast.success("Salvo."))}>
            Salvar
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4 flex items-center gap-3"><User className="h-6 w-6 text-primary" />
          <div><p className="text-2xl font-bold">{counts.pendUser}</p><p className="text-xs text-muted-foreground">Reportados por usuários (pendentes)</p></div></Card>
        <Card className="p-4 flex items-center gap-3"><Bot className="h-6 w-6 text-destructive" />
          <div><p className="text-2xl font-bold">{counts.pendAuto}</p><p className="text-xs text-muted-foreground">Detectados automaticamente (pendentes)</p></div></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["todos", "usuario", "automatico"] as const).map((o) => (
          <Button key={o} size="sm" variant={origin === o ? "default" : "outline"} onClick={() => setOrigin(o)}>
            {o === "todos" ? "Todas as origens" : o === "usuario" ? "Usuários" : "Automáticos"}
          </Button>
        ))}
        <span className="mx-1 text-muted-foreground">|</span>
        {["todos", ...Object.keys(STATUS)].map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
            {s === "todos" ? "Todos" : STATUS[s]}
          </Button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Atualizar</Button>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Exportar CSV</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Nenhum reporte neste filtro.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Card key={r.id} className="p-4">
              <button className="flex w-full items-start gap-3 text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
                {r.origin === "usuario" ? <User className="mt-0.5 h-5 w-5 text-primary" /> : <Bug className="mt-0.5 h-5 w-5 text-destructive" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={r.origin === "usuario" ? "default" : "destructive"}>
                      {r.origin === "usuario" ? "Reportado por usuário" : `Automático · ${KIND[r.error_kind ?? ""] ?? "Erro"}`}
                    </Badge>
                    <Badge variant="outline">{STATUS[r.status]}</Badge>
                    {r.reward_granted_at && <Badge variant="secondary">+{r.reward_credits} Créditos de IA</Badge>}
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">{r.description || r.error_message}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.page_url}</p>
                </div>
              </button>

              {open === r.id && (
                <div className="mt-4 space-y-3 border-t pt-4 text-sm">
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <div><dt className="text-xs text-muted-foreground">Quem</dt><dd>{r.reporter_name || (r.user_id ? "Usuário logado" : "Visitante")} {r.reporter_email ? `· ${r.reporter_email}` : ""}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">ID do usuário</dt><dd className="font-mono text-xs break-all">{r.user_id ?? "—"}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Página</dt><dd className="break-all"><a className="text-primary underline" href={r.page_url ?? "#"} target="_blank" rel="noreferrer">{r.page_url}</a></dd></div>
                    {r.description && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Relato do usuário</dt><dd className="whitespace-pre-wrap">{r.description}</dd></div>}
                    {r.error_message && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Mensagem de erro</dt><dd className="font-mono text-xs break-all">{r.error_message}</dd></div>}
                  </dl>
                  {r.stack_trace && (
                    <div><p className="text-xs text-muted-foreground">Rastreamento técnico</p>
                      <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{r.stack_trace}</pre></div>
                  )}
                  <div><p className="text-xs text-muted-foreground">Aparelho e navegador</p>
                    <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(r.browser_info, null, 2)}</pre></div>

                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS).map(([k, v]) => (
                      <Button key={k} size="sm" variant={r.status === k ? "default" : "outline"} onClick={() => update(r, { status: k })}>{v}</Button>
                    ))}
                  </div>
                  <div>
                    <Label>Anotações da equipe</Label>
                    <Textarea rows={2} value={notes[r.id] ?? r.admin_notes ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => update(r, { admin_notes: notes[r.id] ?? r.admin_notes })}>Salvar anotação</Button>
                  </div>
                  {r.origin === "usuario" && r.user_id && !r.reward_granted_at && (
                    <div className="flex items-end gap-2">
                      <div><Label>Créditos de IA</Label>
                        <Input type="number" min={1} max={1000} className="w-24" value={grant[r.id] ?? reward}
                          onChange={(e) => setGrant({ ...grant, [r.id]: Math.max(1, Number(e.target.value) || 1) })} /></div>
                      <Button size="sm" onClick={() => giveReward(r)}><Gift className="h-4 w-4 mr-1" />Conceder Créditos de IA</Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
