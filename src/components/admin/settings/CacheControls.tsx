import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  clearCacheAndReload,
  forceGlobalCacheRefresh,
  runServerMaintenance,
  saveMaintenanceInterval,
} from "@/lib/cacheManager";
import { supabase } from "@/integrations/supabase/client";

const INTERVALS = [12, 24, 48, 72];

export default function CacheControls() {
  const [busy, setBusy] = useState(false);
  const [hours, setHours] = useState(24);
  const [lastRun, setLastRun] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("key,value")
      .in("key", ["maintenance_config", "maintenance_status"])
      .then(({ data }) => {
        data?.forEach((r) => {
          const v = r.value as Record<string, unknown>;
          if (r.key === "maintenance_config" && Number(v?.client_interval_hours)) setHours(Number(v.client_interval_hours));
          if (r.key === "maintenance_status" && v?.last_run_at) setLastRun(String(v.last_run_at));
        });
      });
  }, []);

  const forceAll = async () => {
    setBusy(true);
    try {
      await forceGlobalCacheRefresh();
      toast.success("Todos os usuários receberão a versão mais recente ao voltar ao site.");
    } catch {
      toast.error("Não foi possível forçar a atualização. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const changeInterval = async (h: number) => {
    setHours(h);
    try {
      await saveMaintenanceInterval(h);
      toast.success(`Limpeza automática nos aparelhos a cada ${h} horas.`);
    } catch {
      toast.error("Não foi possível salvar a periodicidade.");
    }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const r = await runServerMaintenance();
      setLastRun(r.last_run_at);
      toast.success(`Manutenção concluída: ${r.beta_reports_removed + r.login_attempts_removed} registros antigos removidos.`);
    } catch {
      toast.error("Não foi possível executar a manutenção agora.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div>
        <h3 className="font-semibold">Cache e desempenho</h3>
        <p className="text-sm text-muted-foreground">
          Limpe dados guardados no navegador para ver alterações imediatamente. O login é preservado.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={clearCacheAndReload}>
          <Trash2 className="h-4 w-4 mr-2" /> Limpar cache local e recarregar
        </Button>
        <Button type="button" onClick={forceAll} disabled={busy}>
          <RefreshCw className="h-4 w-4 mr-2" /> Forçar atualização para todos os usuários
        </Button>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <h4 className="font-medium">Manutenção automática</h4>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Limpeza nos aparelhos dos usuários a cada:</span>
          {INTERVALS.map((h) => (
            <Button key={h} type="button" size="sm" variant={hours === h ? "default" : "outline"} onClick={() => changeInterval(h)}>
              {h}h
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Limpeza do banco de dados: todos os dias às 03h00 (horário de Brasília). Última execução:{" "}
          {lastRun ? new Date(lastRun).toLocaleString("pt-BR") : "ainda não executada"}.
        </p>
        <Button type="button" variant="outline" onClick={runNow} disabled={busy}>
          <Wrench className="h-4 w-4 mr-2" /> Executar manutenção agora
        </Button>
      </div>
    </div>
  );
}
