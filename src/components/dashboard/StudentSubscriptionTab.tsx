import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FileText, ClipboardList, Award, StickyNote, HelpCircle, GraduationCap, AlertTriangle, Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";

const SERVICE_META: Record<string, { label: string; icon: React.ElementType; resourceType: string }> = {
  service_revisoes: { label: "Revisões", icon: BookOpen, resourceType: "revisao" },
  service_resumos: { label: "Resumos", icon: FileText, resourceType: "resumo" },
  service_simulados: { label: "Simulados", icon: ClipboardList, resourceType: "simulado" },
  service_top_questoes: { label: "Top Questões", icon: Award, resourceType: "top_questoes" },
  service_colinhas: { label: "Colinhas", icon: StickyNote, resourceType: "colinha" },
  service_duvidas: { label: "Dúvidas", icon: HelpCircle, resourceType: "duvida" },
  service_aula_particular: { label: "Aula Particular", icon: GraduationCap, resourceType: "aula_particular" },
};

interface PlanData {
  id: string;
  name: string;
  price: number;
  [key: string]: unknown;
}

interface SubscriptionData {
  id: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  plan_id: string;
  subscription_plans: PlanData;
}

export default function StudentSubscriptionTab() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error("Não foi possível abrir o portal de gerenciamento.");
      console.error(err);
    } finally {
      setPortalLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);

      // Fetch active subscription with plan details
      const { data: sub } = await supabase
        .from("student_subscriptions")
        .select("id, status, started_at, expires_at, plan_id, subscription_plans(id, name, price, service_revisoes, service_revisoes_qty, service_resumos, service_resumos_qty, service_simulados, service_simulados_qty, service_top_questoes, service_top_questoes_qty, service_colinhas, service_colinhas_qty, service_duvidas, service_duvidas_qty, service_aula_particular, service_aula_particular_qty)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub) {
        setSubscription(sub as unknown as SubscriptionData);

        // Fetch usage counts grouped by resource_type for this subscription
        const { data: usage } = await supabase
          .from("resource_usage")
          .select("resource_type")
          .eq("user_id", user.id)
          .eq("subscription_id", sub.id);

        const counts: Record<string, number> = {};
        (usage || []).forEach((u) => {
          counts[u.resource_type] = (counts[u.resource_type] || 0) + 1;
        });
        setUsageCounts(counts);
      }

      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div>
        <h2 className="font-display text-lg font-semibold mb-4">Assinatura e Compras</h2>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div>
        <h2 className="font-display text-lg font-semibold mb-4">Assinatura e Compras</h2>
        <p className="text-sm text-muted-foreground">Você ainda não possui assinatura ativa. Em breve, planos estarão disponíveis.</p>
      </div>
    );
  }

  const plan = subscription.subscription_plans as unknown as Record<string, unknown>;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-1">Assinatura e Compras</h2>
      <div className="flex items-center gap-2 mb-6">
        <Badge variant="default">{plan.name as string}</Badge>
        <span className="text-xs text-muted-foreground">
          Desde {new Date(subscription.started_at).toLocaleDateString("pt-BR")}
          {subscription.expires_at && ` · Expira em ${new Date(subscription.expires_at).toLocaleDateString("pt-BR")}`}
        </span>
      </div>

      <h3 className="text-sm font-medium mb-3">Uso dos Recursos</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(SERVICE_META).map(([key, meta]) => {
          const enabled = plan[key] as boolean;
          if (!enabled) return null;

          const qtyKey = `${key}_qty`;
          const total = (plan[qtyKey] as number) || 0;
          const used = usageCounts[meta.resourceType] || 0;
          const remaining = Math.max(0, total - used);
          const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
          const isExhausted = total > 0 && used >= total;
          const Icon = meta.icon;

          return (
            <Card key={key} className={`border ${isExhausted ? "border-destructive/40" : "border-border"}`}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-primary" />
                  {meta.label}
                  {isExhausted && <AlertTriangle className="h-3.5 w-3.5 text-destructive ml-auto" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <Progress value={pct} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{used} usado{used !== 1 ? "s" : ""}</span>
                  <span>{remaining} restante{remaining !== 1 ? "s" : ""} de {total}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {Object.entries(SERVICE_META).every(([key]) => !(plan[key] as boolean)) && (
        <p className="text-sm text-muted-foreground mt-2">Nenhum serviço incluído neste plano.</p>
      )}
    </div>
  );
}
