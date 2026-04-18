import { useState, useEffect } from "react";
import { Settings, Palette, Phone, FileText, Star, Layout, Gift, FolderOpen, Mail, Package, FileSignature, Smartphone, Heart, GraduationCap, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SettingsBranding from "./settings/SettingsBranding";
import SettingsContact from "./settings/SettingsContact";
import SettingsPages from "./settings/SettingsPages";
import SettingsHeroBanner from "./settings/SettingsHeroBanner";
import SettingsFeaturedVideos from "./settings/SettingsFeaturedVideos";
import SettingsFreeTrial from "./settings/SettingsFreeTrial";
import SettingsCourseAreas from "./settings/SettingsCourseAreas";
import SettingsEmailTemplates from "./settings/SettingsEmailTemplates";
import SettingsTeacherBanner from "./settings/SettingsTeacherBanner";
import SettingsProductConfig from "./settings/SettingsProductConfig";
import SettingsTeacherContract from "./settings/SettingsTeacherContract";
import SettingsTwilio from "./settings/SettingsTwilio";
import SettingsRetentionCoupon from "./settings/SettingsRetentionCoupon";

const sections = [
  { id: "branding", label: "Identidade Visual", icon: Palette },
  { id: "contact", label: "Dados e Contatos", icon: Phone },
  { id: "emails", label: "E-mails", icon: Mail },
  { id: "pages", label: "Páginas Institucionais", icon: FileText },
  { id: "hero", label: "Banner Visitante", icon: Layout },
  { id: "hero_student", label: "Banner Aluno", icon: GraduationCap },
  { id: "hero_teacher", label: "Banner Professor (logado)", icon: Users },
  { id: "teacher_banner", label: "Banner Recrutamento", icon: Layout },
  { id: "featured", label: "Vídeos em Destaque", icon: Star },
  { id: "areas", label: "Áreas de Cursos", icon: FolderOpen },
  { id: "trial", label: "Teste Grátis", icon: Gift },
  { id: "products", label: "Config. de Produtos", icon: Package },
  { id: "contract", label: "Contrato do Professor", icon: FileSignature },
  { id: "twilio", label: "Verificação Celular", icon: Smartphone },
  { id: "retention", label: "Retenção (Cupom)", icon: Heart },
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
      {activeSection === "hero" && (
        <SettingsHeroBanner
          settingsKey="hero_banner"
          description="Banner exibido na home para visitantes (não logados). O administrador vê os banners de aluno e professor em um carrossel automático."
        />
      )}
      {activeSection === "hero_student" && (
        <SettingsHeroBanner
          settingsKey="hero_banner_student"
          description="Banner exibido na home para alunos logados. Também aparece como um dos slides do carrossel da home do administrador."
        />
      )}
      {activeSection === "hero_teacher" && (
        <SettingsHeroBanner
          settingsKey="hero_banner_teacher"
          description="Banner exibido na home para professores logados. Também aparece como um dos slides do carrossel da home do administrador."
        />
      )}
      {activeSection === "teacher_banner" && <SettingsTeacherBanner />}
      {activeSection === "featured" && <SettingsFeaturedVideos />}
      {activeSection === "areas" && <SettingsCourseAreas />}
      {activeSection === "trial" && <SettingsFreeTrial />}
      {activeSection === "products" && <SettingsProductConfig />}
      {activeSection === "contract" && <SettingsTeacherContract />}
      {activeSection === "twilio" && <SettingsTwilio />}
      {activeSection === "retention" && <SettingsRetentionCoupon />}
    </div>
  );
};

export default AdminSettingsTab;
