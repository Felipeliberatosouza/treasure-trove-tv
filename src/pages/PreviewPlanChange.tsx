import { useState } from "react";
import { Button } from "@/components/ui/button";
import PlanChangeCheckoutModal from "@/components/dashboard/subscription/PlanChangeCheckoutModal";
import type { PlanOption } from "@/components/dashboard/subscription/plan-change/PlanOption";

const currentPlan: PlanOption = {
  id: "p1",
  name: "PLANO ESSENCIAL",
  price: 49,
  highlighted: false,
  features: ["Acesso a todos os cursos", "Suporte"],
  service_revisoes: true,
  service_revisoes_qty: 5,
};

const upgradePlan: PlanOption = {
  id: "p2",
  name: "PLANO PREMIUM",
  price: 99,
  highlighted: true,
  features: ["Acesso a todos os cursos", "Suporte prioritário", "Aulas particulares"],
  service_revisoes: true,
  service_revisoes_qty: 15,
  service_aula_particular: true,
  service_aula_particular_qty: 2,
};

const downgradePlan: PlanOption = {
  id: "p0",
  name: "PLANO BÁSICO",
  price: 29,
  highlighted: false,
  features: ["Acesso a cursos selecionados"],
};

export default function PreviewPlanChange() {
  const [openUp, setOpenUp] = useState(false);
  const [openDown, setOpenDown] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="space-y-4 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold">Preview — Modal de Troca de Plano</h1>
        <p className="text-muted-foreground text-sm">
          Mockup visual sem backend. Ciclo simulado: 30 dias, 12 dias usados.
        </p>
        <div className="flex flex-col gap-3">
          <Button onClick={() => setOpenUp(true)}>Ver Upgrade (R$ 49 → R$ 99)</Button>
          <Button variant="outline" onClick={() => setOpenDown(true)}>
            Ver Downgrade (R$ 49 → R$ 29)
          </Button>
        </div>
      </div>

      <PlanChangeCheckoutModal
        open={openUp}
        onOpenChange={setOpenUp}
        currentPlan={currentPlan}
        newPlan={upgradePlan}
        daysUsed={12}
        totalDays={30}
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 800));
        }}
      />

      <PlanChangeCheckoutModal
        open={openDown}
        onOpenChange={setOpenDown}
        currentPlan={currentPlan}
        newPlan={downgradePlan}
        daysUsed={12}
        totalDays={30}
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 800));
        }}
      />
    </div>
  );
}
