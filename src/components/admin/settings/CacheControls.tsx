import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearCacheAndReload, forceGlobalCacheRefresh } from "@/lib/cacheManager";

export default function CacheControls() {
  const [busy, setBusy] = useState(false);
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
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
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
    </div>
  );
}
