import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, FileText, ClipboardList, Award, StickyNote, HelpCircle, GraduationCap, AlertTriangle, Settings, Loader2, ArrowLeftRight, XCircle, History } from "lucide-react";
import { toast } from "sonner";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useActiveSubscription } from "@/hooks/useActiveSubscription";
import SubscriptionStatement from "./subscription/SubscriptionStatement";
import PlanChangeModal from "./subscription/PlanChangeModal";
import PlanChangeCheckoutModal from "./subscription/PlanChangeCheckoutModal";
import CancelSubscriptionModal from "./subscription/CancelSubscriptionModal";
import PurchaseHistory from "./subscription/PurchaseHistory";
import { redirectTopLevel } from "@/lib/payments";

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
  allow_free_cancel: boolean;
  min_commitment_days: number;
  min_usage_charge_pct: number;
  cancel_text: string;
  [key: string]: unknown;
}

interface SubscriptionData {
  id: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  plan_id: string;
  created_at: string;
  subscription_plans: PlanData;
}

interface Purchase {
  id: string;
  content_id: string | null;
  content_type: string;
  amount: number;
  payment_status: string;
  created_at: string;
}

export default function StudentSubscriptionTab() {
  const { user, refreshSubscription } = useAuth();
  const { logAction } = useAuditLog();
  // Shared lightweight active-subscription state. Used to:
  // - Skip the heavy join query when we already know the user has none
  // - Notify the navbar (via refresh) after plan change / cancellation
  const { isActive: hasActiveSub, loading: activeSubLoading, refresh: refreshActiveSub } = useActiveSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSubscription, setActiveSubscription] = useState<SubscriptionData | null>(null);
  const [allSubscriptions, setAllSubscriptions] = useState<SubscriptionData[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [availablePlans, setAvailablePlans] = useState<import("./subscription/PlanChangeModal").PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showPlanChange, setShowPlanChange] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [pendingNewPlan, setPendingNewPlan] = useState<import("./subscription/PlanChangeModal").PlanOption | null>(null);
  const [showCancel, setShowCancel] = useState(false);

  // Auto-open plan change modal when redirected with ?action=change-plan
  // (e.g. from PricingSection when user already has an active subscription).
  useEffect(() => {
    if (loading) return;
    const action = searchParams.get("action");
    if (action === "change-plan" && activeSubscription) {
      setShowPlanChange(true);
      const next = new URLSearchParams(searchParams);
      next.delete("action");
      setSearchParams(next, { replace: true });
    }
  }, [loading, activeSubscription, searchParams, setSearchParams]);

  // Load all subscription data. Extracted into a callback so we can re-run it
  // after the user returns from the Stripe Customer Portal (a plan change
  // there only becomes visible after `check-subscription` re-syncs the local
  // student_subscriptions table).
  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: subs } = await supabase
      .from("student_subscriptions")
      .select("id, status, started_at, expires_at, plan_id, created_at, subscription_plans(id, name, price, service_revisoes, service_revisoes_qty, service_resumos, service_resumos_qty, service_simulados, service_simulados_qty, service_top_questoes, service_top_questoes_qty, service_colinhas, service_colinhas_qty, service_duvidas, service_duvidas_qty, service_aula_particular, service_aula_particular_qty, allow_free_cancel, min_commitment_days, min_usage_charge_pct, cancel_text)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const subscriptions = (subs || []) as unknown as SubscriptionData[];
    setAllSubscriptions(subscriptions);

    const active = subscriptions.find(s => s.status === "active") || null;
    setActiveSubscription(active);

    if (active) {
      const { data: usage } = await supabase
        .from("resource_usage")
        .select("resource_type")
        .eq("user_id", user.id)
        .eq("subscription_id", active.id);

      const counts: Record<string, number> = {};
      (usage || []).forEach((u) => {
        counts[u.resource_type] = (counts[u.resource_type] || 0) + 1;
      });
      setUsageCounts(counts);
    }

    const { data: purchaseData } = await supabase
      .from("video_purchases")
      .select("id, content_id, content_type, amount, payment_status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setPurchases((purchaseData || []) as Purchase[]);

    const { data: plansData } = await supabase
      .from("subscription_plans")
      .select("id, name, price, highlighted, features, service_revisoes, service_revisoes_qty, service_resumos, service_resumos_qty, service_simulados, service_simulados_qty, service_top_questoes, service_top_questoes_qty, service_colinhas, service_colinhas_qty, service_duvidas, service_duvidas_qty, service_aula_particular, service_aula_particular_qty")
      .eq("active", true)
      .order("sort_order");

    setAvailablePlans((plansData || []) as import("./subscription/PlanChangeModal").PlanOption[]);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (activeSubLoading) return;
    loadAll();
  }, [user, activeSubLoading, hasActiveSub, loadAll]);

  // When the user returns to this tab after visiting the Stripe Customer
  // Portal (plan change / cancellation), force a fresh check-subscription
  // round-trip so the historical record is archived and the new plan shows
  // up in the history list. We debounce by tracking the last sync time.
  const lastSyncRef = useRef<number>(0);
  useEffect(() => {
    if (!user) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastSyncRef.current < 5000) return; // debounce
      lastSyncRef.current = now;
      // Re-sync from Stripe → archives old plan, inserts new one if changed.
      await refreshSubscription();
      // Re-fetch local DB to refresh the History tab.
      await loadAll();
      await refreshActiveSub();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [user, refreshSubscription, loadAll, refreshActiveSub]);

  // Centralized helper from lib/payments dispatches the overlay event
  // and uses window.location (not window.top), so it works inside the
  // Lovable preview iframe without leaving the app frame blank.

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) redirectTopLevel(data.url, { title: "Abrindo portal de gerenciamento..." });
    } catch {
      toast.error("Não foi possível abrir o portal de gerenciamento.");
    } finally {
      setPortalLoading(false);
    }
  };

  // User picked a target plan in the comparison modal — open the in-app
  // checkout modal (Stripe Elements) to confirm the change with prorated charge.
  const handlePlanChange = async (newPlanId: string) => {
    const newPlan = availablePlans.find(p => p.id === newPlanId);
    if (!newPlan) {
      toast.error("Plano selecionado não encontrado.");
      return;
    }
    setPendingNewPlan(newPlan);
    setShowPlanChange(false);
    setShowCheckout(true);
  };

  // Called by PlanChangeCheckoutModal after the Stripe-side change succeeds.
  // Sends notification emails, refreshes local state.
  const sendPlanChangeNotifications = async (newPlan: import("./subscription/PlanChangeModal").PlanOption) => {
    const plan = activeSubscription?.subscription_plans as unknown as PlanData;
    const cycleInfo = activeSubscription ? getCycleInfo(activeSubscription) : null;
    if (!user?.email || !plan || !cycleInfo) return;

    const isUpgrade = newPlan.price > plan.price;
    const daysRemaining = Math.max(0, cycleInfo.totalDays - cycleInfo.daysUsed);
    const dailyRateCurrent = cycleInfo.totalDays > 0 ? plan.price / cycleInfo.totalDays : 0;
    const creditRemaining = dailyRateCurrent * daysRemaining;
    const dailyRateNew = cycleInfo.totalDays > 0 ? newPlan.price / cycleInfo.totalDays : 0;
    const costRemaining = dailyRateNew * daysRemaining;
    const balanceRaw = costRemaining - creditRemaining; // >0 charge, <0 credit
    const proRata = Math.abs(balanceRaw);
    const studentName = user.user_metadata?.name || "";
    const effectiveDate = new Date().toLocaleDateString("pt-BR");
    const fmtBRL = (n: number) => `R$ ${n.toFixed(2)}`;
    const proRataAmount = fmtBRL(proRata);
    const proRataExplanation = isUpgrade
      ? `Diferença proporcional de ${daysRemaining} dias restantes no ciclo atual.`
      : `Crédito de ${daysRemaining} dias restantes será aplicado na próxima fatura.`;
    const balanceType: "charge" | "credit" | "none" =
      balanceRaw > 0.005 ? "charge" : balanceRaw < -0.005 ? "credit" : "none";
    const balanceLabel =
      balanceType === "charge"
        ? `Saldo a pagar agora: ${fmtBRL(balanceRaw)}`
        : balanceType === "credit"
          ? `Saldo de crédito: ${fmtBRL(Math.abs(balanceRaw))} (próxima fatura)`
          : "Sem saldo a ajustar";

    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "plan-changed",
          recipientEmail: user.email,
          idempotencyKey: `plan-change-${activeSubscription!.id}-${newPlan.id}-${Date.now()}`,
          templateData: {
            name: studentName,
            previousPlan: plan.name,
            newPlan: newPlan.name,
            changeType: isUpgrade ? "upgrade" : "downgrade",
            proRataAmount,
            proRataExplanation,
            effectiveDate,
            daysUsed: cycleInfo.daysUsed,
            daysRemaining,
            totalDays: cycleInfo.totalDays,
            creditAmount: fmtBRL(creditRemaining),
            newProRataAmount: fmtBRL(costRemaining),
            balanceLabel,
            balanceType,
          },
        },
      });

      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (admins) {
        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("email")
          .in("user_id", admins.map(a => a.user_id));

        for (const admin of adminProfiles || []) {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "subscription-change-admin-notify",
              recipientEmail: admin.email,
              idempotencyKey: `plan-change-admin-${admin.email}-${activeSubscription!.id}-${Date.now()}`,
              templateData: {
                studentName,
                studentEmail: user.email,
                actionType: "plan-change",
                previousPlan: plan.name,
                newPlan: newPlan.name,
                changeType: isUpgrade ? "upgrade" : "downgrade",
                proRataAmount,
                proRataExplanation,
                effectiveDate,
              },
            },
          });
        }
      }
    } catch (e) {
      console.error("[StudentSubscriptionTab] notification error", e);
    }

    logAction("plan_changed", {
      targetTable: "student_subscriptions",
      targetId: activeSubscription?.id,
      metadata: {
        previous_plan: plan?.name,
        new_plan: newPlan?.name,
        change_type: isUpgrade ? "upgrade" : "downgrade",
      },
    });
  };

  const handleCheckoutSuccess = async () => {
    if (pendingNewPlan) {
      await sendPlanChangeNotifications(pendingNewPlan);
    }
    setPendingNewPlan(null);
    // Re-sync from Stripe + reload local data so UI reflects the new plan.
    await refreshSubscription();
    await loadAll();
    await refreshActiveSub();
  };

  const handleCancel = async () => {
    const plan = activeSubscription?.subscription_plans as unknown as PlanData;
    const cycleInfo = activeSubscription ? getCycleInfo(activeSubscription) : null;

    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;

      // Send cancellation notification email
      if (user?.email && plan && cycleInfo) {
        const dailyRate = cycleInfo.totalDays > 0 ? plan.price / cycleInfo.totalDays : 0;
        const usedAmount = dailyRate * cycleInfo.daysUsed;
        const minCharge = ((plan.min_usage_charge_pct || 0) / 100) * plan.price;
        const chargeAmount = Math.max(usedAmount, minCharge);
        const studentName = user.user_metadata?.name || "";
        const effectiveDate = new Date().toLocaleDateString("pt-BR");
        const proRataAmount = `R$ ${chargeAmount.toFixed(2)}`;
        const proRataExplanation = `Cobrança proporcional: ${cycleInfo.daysUsed} dias usados de ${cycleInfo.totalDays}. Mínimo: ${plan.min_usage_charge_pct || 0}% do plano.`;

        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "subscription-cancelled",
            recipientEmail: user.email,
            idempotencyKey: `cancel-${activeSubscription!.id}-${Date.now()}`,
            templateData: {
              name: studentName,
              planName: plan.name,
              expiryDate: effectiveDate,
              reason: "cancelada",
            },
          },
        });

        // Notify admins
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        if (admins) {
          const { data: adminProfiles } = await supabase
            .from("profiles")
            .select("email")
            .in("user_id", admins.map(a => a.user_id));

          for (const admin of adminProfiles || []) {
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "subscription-change-admin-notify",
                recipientEmail: admin.email,
                idempotencyKey: `cancel-admin-${admin.email}-${activeSubscription!.id}-${Date.now()}`,
                templateData: {
                  studentName,
                  studentEmail: user.email,
                  actionType: "cancellation",
                  previousPlan: plan.name,
                  proRataAmount,
                  proRataExplanation,
                  effectiveDate,
                },
              },
            });
          }
        }
      }

      const cancelledPlan = activeSubscription?.subscription_plans as unknown as PlanData;
      logAction("subscription_cancelled", {
        targetTable: "student_subscriptions",
        targetId: activeSubscription?.id,
        metadata: { plan_name: cancelledPlan?.name },
      });

      toast.success("Redirecionando para o portal de cancelamento...");
      // Refresh shared subscription state so navbar reflects the change.
      refreshActiveSub();
      if (data?.url) redirectTopLevel(data.url, { title: "Abrindo portal de cancelamento..." });
    } catch {
      toast.error("Não foi possível processar o cancelamento.");
    }
  };

  // Calculate cycle info
  const getCycleInfo = (sub: SubscriptionData) => {
    const startDate = new Date(sub.started_at);
    const now = new Date();
    // Assume 30-day cycle
    const cycleStart = new Date(startDate);
    while (cycleStart < now) {
      const nextCycle = new Date(cycleStart);
      nextCycle.setDate(nextCycle.getDate() + 30);
      if (nextCycle > now) break;
      cycleStart.setDate(cycleStart.getDate() + 30);
    }
    const daysUsed = Math.floor((now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = 30;
    const totalSubscriptionDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return { daysUsed: Math.min(daysUsed, totalDays), totalDays, totalSubscriptionDays };
  };

  // Build statement entries from subscription history
  const buildStatementEntries = () => {
    const entries: { date: string; type: "subscription_start" | "plan_change" | "cancellation" | "renewal" | "purchase"; description: string; amount: number; explanation: string; pdfData?: import("@/lib/planChangePdf").PlanChangePdfData }[] = [];

    // Chronological order (oldest first) so we can detect plan transitions
    const chrono = allSubscriptions.slice().sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    );

    chrono.forEach((sub, idx) => {
      const plan = sub.subscription_plans as unknown as PlanData;
      const prev = idx > 0 ? chrono[idx - 1] : null;
      const prevPlan = prev ? (prev.subscription_plans as unknown as PlanData) : null;

      // Detect plan change: previous sub was closed and this one started within 24h
      const isPlanChange =
        !!prev &&
        !!prevPlan &&
        (prev.status === "expired" || prev.status === "cancelled") &&
        Math.abs(new Date(sub.started_at).getTime() - new Date(prev.expires_at || prev.started_at).getTime()) < 24 * 60 * 60 * 1000 &&
        prevPlan.id !== plan.id;

      if (isPlanChange) {
        const diff = plan.price - prevPlan!.price;
        const isUpgrade = diff > 0;
        const direction = isUpgrade ? "Upgrade" : diff < 0 ? "Downgrade" : "Mudança";

        // Pro-rata balance from the previous plan at the moment of switch
        const totalDays = 30;
        const prevStart = new Date(prev!.started_at);
        const switchDate = new Date(sub.started_at);
        const daysUsedPrev = Math.min(
          totalDays,
          Math.max(0, Math.floor((switchDate.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24)))
        );
        const daysRemainingPrev = Math.max(0, totalDays - daysUsedPrev);
        const dailyPrev = prevPlan!.price / totalDays;
        const dailyNew = plan.price / totalDays;
        const creditPrev = dailyPrev * daysRemainingPrev;     // valor não usado do plano anterior
        const proRataNew = dailyNew * daysRemainingPrev;      // o que custaria no plano novo pelos dias restantes
        const balance = proRataNew - creditPrev;              // >0 = aluno paga, <0 = aluno recebe crédito

        const balanceLabel = balance > 0
          ? `Saldo a pagar agora: R$ ${balance.toFixed(2)}`
          : balance < 0
            ? `Saldo de crédito: R$ ${Math.abs(balance).toFixed(2)}`
            : `Sem saldo a ajustar`;

        const explanation =
          `${direction} de ${prevPlan!.name} (R$ ${prevPlan!.price.toFixed(2)}/mês) → ${plan.name} (R$ ${plan.price.toFixed(2)}/mês). ` +
          `Você usou ${daysUsedPrev} de ${totalDays} dias do ${prevPlan!.name}, restavam ${daysRemainingPrev} dias ` +
          `(crédito de R$ ${creditPrev.toFixed(2)}). Esses ${daysRemainingPrev} dias no novo plano custariam R$ ${proRataNew.toFixed(2)}. ` +
          `${balanceLabel}.`;

        entries.push({
          date: sub.started_at,
          type: "plan_change",
          description: `${direction}: ${prevPlan!.name} → ${plan.name}`,
          amount: balance, // mostra o saldo real da troca (positivo = cobrança, negativo = crédito)
          explanation,
          pdfData: {
            studentName: user?.user_metadata?.name || "",
            studentEmail: user?.email || "",
            previousPlan: prevPlan!.name,
            previousPlanPrice: prevPlan!.price,
            newPlan: plan.name,
            newPlanPrice: plan.price,
            changeType: isUpgrade ? "upgrade" : diff < 0 ? "downgrade" : "change",
            totalDays,
            daysUsed: daysUsedPrev,
            daysRemaining: daysRemainingPrev,
            dailyOld: dailyPrev,
            dailyNew,
            credit: creditPrev,
            newProRata: proRataNew,
            balance,
            effectiveDate: new Date(sub.started_at).toLocaleDateString("pt-BR"),
          },
        });
      } else {
        entries.push({
          date: sub.started_at,
          type: "subscription_start",
          description: `Assinatura ${plan.name}`,
          amount: plan.price,
          explanation: `Início da assinatura do plano ${plan.name} no valor de R$ ${plan.price.toFixed(2)}/mês.`,
        });
      }

      // Cancellation / expiration entry — only when NOT immediately followed by a plan change
      const next = idx < chrono.length - 1 ? chrono[idx + 1] : null;
      const nextIsPlanChange =
        !!next &&
        Math.abs(new Date(next.started_at).getTime() - new Date(sub.expires_at || sub.started_at).getTime()) < 24 * 60 * 60 * 1000 &&
        ((next.subscription_plans as unknown as PlanData).id !== plan.id);

      if ((sub.status === "cancelled" || sub.status === "expired") && !nextIsPlanChange) {
        const endDate = sub.expires_at || sub.started_at;
        const start = new Date(sub.started_at);
        const end = new Date(endDate);
        const totalDays = 30;
        const daysUsed = Math.min(Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)), totalDays);
        const dailyRate = plan.price / totalDays;
        const usedAmount = dailyRate * daysUsed;
        const minCharge = ((plan.min_usage_charge_pct || 0) / 100) * plan.price;
        const chargeAmount = Math.max(usedAmount, minCharge);

        let explanation = `Cancelamento após ${daysUsed} dias de uso. Valor proporcional: R$ ${usedAmount.toFixed(2)}.`;
        if (minCharge > usedAmount && plan.min_usage_charge_pct > 0) {
          explanation += ` Cobrança mínima de ${plan.min_usage_charge_pct}% aplicada: R$ ${minCharge.toFixed(2)}.`;
        }
        explanation += ` Valor final cobrado: R$ ${chargeAmount.toFixed(2)}.`;

        entries.push({
          date: endDate,
          type: "cancellation",
          description: `Cancelamento ${plan.name}`,
          amount: chargeAmount,
          explanation,
        });
      }
    });

    // Add purchases
    purchases.filter(p => p.payment_status === "completed").forEach(p => {
      entries.push({
        date: p.created_at,
        type: "purchase",
        description: `Compra avulsa`,
        amount: p.amount,
        explanation: `Compra avulsa no valor de R$ ${p.amount.toFixed(2)}.`,
      });
    });

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  if (loading) {
    return (
      <div>
        <h2 className="font-display text-lg font-semibold mb-4">Assinatura e Compras</h2>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const plan = activeSubscription ? (activeSubscription.subscription_plans as unknown as PlanData) : null;
  const cycleInfo = activeSubscription ? getCycleInfo(activeSubscription) : null;
  const statementEntries = buildStatementEntries();

  return (
    <div className="space-y-6">
      <h2 className="font-display text-lg font-semibold mb-1">Assinatura e Compras</h2>

      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="current">Plano Atual</TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-3.5 w-3.5 mr-1" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="purchases">Minhas Compras</TabsTrigger>
        </TabsList>

        {/* Current Plan Tab */}
        <TabsContent value="current" className="space-y-4 mt-4">
          {!activeSubscription ? (
            <p className="text-sm text-muted-foreground">Você ainda não possui assinatura ativa.</p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="default">{plan!.name}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Desde {new Date(activeSubscription.started_at).toLocaleDateString("pt-BR")}
                    {activeSubscription.expires_at && ` · Expira em ${new Date(activeSubscription.expires_at).toLocaleDateString("pt-BR")}`}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleManageSubscription} disabled={portalLoading}>
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Settings className="h-4 w-4 mr-1" />}
                  Gerenciar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowPlanChange(true)}>
                  <ArrowLeftRight className="h-4 w-4 mr-1" />
                  Mudar Plano
                </Button>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setShowCancel(true)}>
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </div>

              {/* Resource usage */}
              <h3 className="text-sm font-medium">Uso dos Recursos</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(SERVICE_META).map(([key, meta]) => {
                  const enabled = plan![key as keyof PlanData] as boolean;
                  if (!enabled) return null;

                  const qtyKey = `${key}_qty`;
                  const total = (plan![qtyKey as keyof PlanData] as number) || 0;
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

              {Object.entries(SERVICE_META).every(([key]) => !(plan![key as keyof PlanData] as boolean)) && (
                <p className="text-sm text-muted-foreground">Nenhum serviço incluído neste plano.</p>
              )}

              {/* Plan Change Modal */}
              <PlanChangeModal
                open={showPlanChange}
                onOpenChange={setShowPlanChange}
                currentPlanId={plan!.id}
                currentPlanPrice={plan!.price}
                currentPlanName={plan!.name}
                currentPlanServices={plan as unknown as import("./subscription/PlanChangeModal").PlanOption}
                daysUsed={cycleInfo!.daysUsed}
                totalDays={cycleInfo!.totalDays}
                plans={availablePlans}
                onConfirm={handlePlanChange}
              />

              {/* In-app Stripe checkout for the actual change (Elements) */}
              {pendingNewPlan && (
                <PlanChangeCheckoutModal
                  open={showCheckout}
                  onOpenChange={(v) => {
                    setShowCheckout(v);
                    if (!v) setPendingNewPlan(null);
                  }}
                  currentPlan={plan as unknown as import("./subscription/PlanChangeModal").PlanOption}
                  newPlan={pendingNewPlan}
                  daysUsed={cycleInfo!.daysUsed}
                  totalDays={cycleInfo!.totalDays}
                  onSuccess={handleCheckoutSuccess}
                />
              )}

              {/* Cancel Modal */}
              <CancelSubscriptionModal
                open={showCancel}
                onOpenChange={setShowCancel}
                planName={plan!.name}
                planPrice={plan!.price}
                daysUsed={cycleInfo!.daysUsed}
                totalDays={cycleInfo!.totalDays}
                minUsageChargePct={plan!.min_usage_charge_pct || 0}
                allowFreeCancel={plan!.allow_free_cancel}
                minCommitmentDays={plan!.min_commitment_days}
                totalSubscriptionDays={cycleInfo!.totalSubscriptionDays}
                onConfirm={handleCancel}
              />
            </>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4 mt-4">
          {allSubscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum histórico de assinatura.</p>
          ) : (
            <>
              {/* Subscription list */}
              <div className="space-y-2">
                {allSubscriptions.map(sub => {
                  const subPlan = sub.subscription_plans as unknown as PlanData;
                  const statusLabel: Record<string, string> = { active: "Ativa", cancelled: "Cancelada", expired: "Expirada", past_due: "Pagamento Pendente" };
                  const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = { active: "default", cancelled: "destructive", expired: "secondary", past_due: "outline" };
                  return (
                    <Card key={sub.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{subPlan.name}</span>
                          <Badge variant={statusVariant[sub.status] || "outline"} className="text-[10px]">
                            {statusLabel[sub.status] || sub.status}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(sub.started_at).toLocaleDateString("pt-BR")}
                          {sub.expires_at && ` — ${new Date(sub.expires_at).toLocaleDateString("pt-BR")}`}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Statement */}
              <SubscriptionStatement
                planName="Geral"
                entries={statementEntries}
              />
            </>
          )}
        </TabsContent>

        {/* Purchases Tab */}
        <TabsContent value="purchases" className="mt-4">
          <PurchaseHistory purchases={purchases} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
