import { useState, useEffect } from "react";
import { Settings, Palette, Phone, FileText, Star, Layout, Gift, FolderOpen, Mail, Package, FileSignature, Smartphone, Heart, GraduationCap, Users, Megaphone, Target, CalendarClock, Sparkles, PanelBottom, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SettingsBranding from "./settings/SettingsBranding";
import SettingsContact from "./settings/SettingsContact";
import SettingsSupport from "./settings/SettingsSupport";
import SettingsPages from "./settings/SettingsPages";
import SettingsHeroBanner from "./settings/SettingsHeroBanner";
import SettingsFeaturedVideos from "./settings/SettingsFeaturedVideos";
import SettingsFreeTrial from "./settings/SettingsFreeTrial";
import SettingsCourseAreas from "./settings/SettingsCourseAreas";
import SettingsEmailTemplates from "./settings/SettingsEmailTemplates";

import SettingsProductConfig from "./settings/SettingsProductConfig";
import SettingsTeacherContract from "./settings/SettingsTeacherContract";
import SettingsTwilio from "./settings/SettingsTwilio";
import SettingsRetentionCoupon from "./settings/SettingsRetentionCoupon";
import SettingsTeacherGoal from "./settings/SettingsTeacherGoal";
import SettingsAulaParticular from "./settings/SettingsAulaParticular";
import SettingsCashback from "./settings/SettingsCashback";
import SettingsFooter from "./settings/SettingsFooter";
import SettingsAlertBox from "./settings/SettingsAlertBox";

const SECTIONS_RAW = [
  { id: "alert_box", label: "Caixa de Alerta", icon: AlertTriangle },
  { id: "aula_particular", label: "Aula Particular", icon: CalendarClock },
  { id: "areas", label: "Áreas de Cursos", icon: FolderOpen },
  { id: "hero_student", label: "Banner Aluno", icon: GraduationCap },
  { id: "hero_teacher", label: "Banner Professor (logado)", icon: Users },
  { id: "secondary_student", label: "Banner Secundário Aluno", icon: Megaphone },
  { id: "secondary_teacher", label: "Banner Secundário Professor", icon: Megaphone },
  { id: "secondary", label: "Banner Secundário Visitante", icon: Megaphone },
  { id: "hero", label: "Banner Visitante", icon: Layout },
  { id: "cashback", label: "Cashback", icon: Sparkles },
  { id: "products", label: "Config. de Produtos", icon: Package },
  { id: "contract", label: "Contrato do Professor", icon: FileSignature },
  { id: "contact", label: "Dados e Contatos", icon: Phone },
  { id: "emails", label: "E-mails", icon: Mail },
  { id: "branding", label: "Identidade Visual", icon: Palette },
  { id: "teacher_goal", label: "Metas do Professor", icon: Target },
  { id: "pages", label: "Páginas Institucionais", icon: FileText },
  { id: "retention", label: "Retenção (Cupom)", icon: Heart },
  { id: "footer", label: "Rodapé", icon: PanelBottom },
  { id: "trial", label: "Teste Grátis", icon: Gift },
  { id: "twilio", label: "Verificação Celular", icon: Smartphone },
  { id: "featured", label: "Vídeos em Destaque", icon: Star },
] as const;

type SectionId = (typeof SECTIONS_RAW)[number]["id"];

// Always render the submenu in alphabetical order (pt-BR). Any new entry added
// to SECTIONS_RAW above is automatically slotted into the correct position.
const sections = [...SECTIONS_RAW].sort((a, b) =>
  a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" })
);

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
      {activeSection === "footer" && <SettingsFooter />}
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
      {activeSection === "secondary" && (
        <SettingsHeroBanner
          settingsKey="secondary_banner"
          description="Banner secundário (acima do rodapé) exibido para visitantes (não logados). O administrador vê os banners de aluno e professor em um carrossel automático."
        />
      )}
      {activeSection === "secondary_student" && (
        <SettingsHeroBanner
          settingsKey="secondary_banner_student"
          description="Banner secundário (acima do rodapé) exibido para alunos logados. Também aparece como um dos slides do carrossel do administrador."
        />
      )}
      {activeSection === "secondary_teacher" && (
        <SettingsHeroBanner
          settingsKey="secondary_banner_teacher"
          description="Banner secundário (acima do rodapé) exibido para professores logados. Também aparece como um dos slides do carrossel do administrador."
        />
      )}
      {activeSection === "featured" && <SettingsFeaturedVideos />}
      {activeSection === "areas" && <SettingsCourseAreas />}
      {activeSection === "trial" && <SettingsFreeTrial />}
      {activeSection === "products" && <SettingsProductConfig />}
      {activeSection === "aula_particular" && <SettingsAulaParticular />}
      {activeSection === "cashback" && <SettingsCashback />}
      {activeSection === "contract" && <SettingsTeacherContract />}
      {activeSection === "teacher_goal" && <SettingsTeacherGoal />}
      {activeSection === "twilio" && <SettingsTwilio />}
      {activeSection === "retention" && <SettingsRetentionCoupon />}
      {activeSection === "alert_box" && <SettingsAlertBox />}
    </div>
  );
};

export default AdminSettingsTab;
