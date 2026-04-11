import { useState } from "react";
import { Settings, Palette, Phone, FileText, Star, Layout, Gift, FolderOpen, Mail } from "lucide-react";
import SettingsBranding from "./settings/SettingsBranding";
import SettingsContact from "./settings/SettingsContact";
import SettingsPages from "./settings/SettingsPages";
import SettingsHeroBanner from "./settings/SettingsHeroBanner";
import SettingsFeaturedVideos from "./settings/SettingsFeaturedVideos";
import SettingsFreeTrial from "./settings/SettingsFreeTrial";
import SettingsCourseAreas from "./settings/SettingsCourseAreas";
import SettingsEmailTemplates from "./settings/SettingsEmailTemplates";
import SettingsTeacherBanner from "./settings/SettingsTeacherBanner";

const sections = [
  { id: "branding", label: "Identidade Visual", icon: Palette },
  { id: "contact", label: "Contato", icon: Phone },
  { id: "emails", label: "E-mails", icon: Mail },
  { id: "pages", label: "Páginas Institucionais", icon: FileText },
  { id: "hero", label: "Banner Principal", icon: Layout },
  { id: "teacher_banner", label: "Banner Professor", icon: Layout },
  { id: "featured", label: "Vídeos em Destaque", icon: Star },
  { id: "areas", label: "Áreas de Cursos", icon: FolderOpen },
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
      {activeSection === "emails" && <SettingsEmailTemplates />}
      {activeSection === "pages" && <SettingsPages />}
      {activeSection === "hero" && <SettingsHeroBanner />}
      {activeSection === "teacher_banner" && <SettingsTeacherBanner />}
      {activeSection === "featured" && <SettingsFeaturedVideos />}
      {activeSection === "areas" && <SettingsCourseAreas />}
      {activeSection === "trial" && <SettingsFreeTrial />}
    </div>
  );
};

export default AdminSettingsTab;
