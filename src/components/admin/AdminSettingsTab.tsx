import { useState } from "react";
import { Settings, Palette, Phone, FileText, Star, CreditCard, DollarSign, Layout, Gift } from "lucide-react";
import SettingsBranding from "./settings/SettingsBranding";
import SettingsContact from "./settings/SettingsContact";
import SettingsPages from "./settings/SettingsPages";
import SettingsHeroBanner from "./settings/SettingsHeroBanner";
import SettingsFeaturedVideos from "./settings/SettingsFeaturedVideos";
import SettingsSubscriptionPlans from "./settings/SettingsSubscriptionPlans";
import SettingsVideoPricing from "./settings/SettingsVideoPricing";
import SettingsFreeTrial from "./settings/SettingsFreeTrial";

const sections = [
  { id: "branding", label: "Identidade Visual", icon: Palette },
  { id: "contact", label: "Contato", icon: Phone },
  { id: "pages", label: "Páginas Institucionais", icon: FileText },
  { id: "hero", label: "Banner Principal", icon: Layout },
  { id: "featured", label: "Vídeos em Destaque", icon: Star },
  { id: "plans", label: "Planos de Assinatura", icon: CreditCard },
  { id: "pricing", label: "Preços de Vídeos", icon: DollarSign },
  { id: "trial", label: "Teste Grátis", icon: Gift },
] as const;

type SectionId = (typeof sections)[number]["id"];

const AdminSettingsTab = () => {
  const [activeSection, setActiveSection] = useState<SectionId>("branding");

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <Settings className="h-5 w-5" /> Configurações da Plataforma
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

      {activeSection === "branding" && <SettingsBranding />}
      {activeSection === "contact" && <SettingsContact />}
      {activeSection === "pages" && <SettingsPages />}
      {activeSection === "hero" && <SettingsHeroBanner />}
      {activeSection === "featured" && <SettingsFeaturedVideos />}
      {activeSection === "plans" && <SettingsSubscriptionPlans />}
      {activeSection === "pricing" && <SettingsVideoPricing />}
      {activeSection === "trial" && <SettingsFreeTrial />}
    </div>
  );
};

export default AdminSettingsTab;
