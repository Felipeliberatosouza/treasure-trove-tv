import { useState } from "react";
import { CreditCard, Sparkles } from "lucide-react";
import AdminPlansTab from "./AdminPlansTab";
import AdminAiCreditsTab from "./AdminAiCreditsTab";

const sections = [
  { id: "plans", label: "Planos de Assinatura", icon: CreditCard },
  { id: "ai", label: "Créditos de IA", icon: Sparkles },
] as const;

type SectionId = (typeof sections)[number]["id"];

const AdminPlansWrapperTab = () => {
  const [activeSection, setActiveSection] = useState<SectionId>("plans");

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <CreditCard className="h-5 w-5" /> Planos e Créditos de IA
      </h2>

      <div className="flex gap-2 flex-wrap mb-6">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              activeSection === s.id
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === "plans" && <AdminPlansTab />}
      {activeSection === "ai" && <AdminAiCreditsTab />}
    </div>
  );
};

export default AdminPlansWrapperTab;
