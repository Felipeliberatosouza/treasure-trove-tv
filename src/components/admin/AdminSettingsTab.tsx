import { useState, useEffect } from "react";
import { Settings, Palette, Phone, FileText, Gift, FolderOpen, Mail, Package, FileSignature, Smartphone, Heart, Megaphone, Target, CalendarClock, Sparkles, PanelBottom, AlertTriangle, Headset } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SettingsBranding from "./settings/SettingsBranding";
import SettingsContact from "./settings/SettingsContact";
import SettingsPages from "./settings/SettingsPages";
import SettingsHeroBanner from "./settings/SettingsHeroBanner";
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
import SettingsAiGeneration from "./settings/SettingsAiGeneration";
import SettingsDoubts from "./settings/SettingsDoubts";

const SECTIONS_RAW = [
  { id: "ai_generation", label: "Gestão de IA", icon: Sparkles },
  { id: "alert_box", label: "Caixa de Alerta", icon: AlertTriangle },
  { id: "aula_particular", label: "Aula Particular", icon: CalendarClock },
  { id: "areas", label: "Áreas de Cursos", icon: FolderOpen },
  { id: "secondary_student", label: "Banner Aluno", icon: Megaphone },
  { id: "secondary_teacher", label: "Banner Professor", icon: Megaphone },
  { id: "secondary", label: "Banner Visitante", icon: Megaphone },
  { id: "cashback", label: "Cashback", icon: Sparkles },
  { id: "products", label: "Config. de Produtos", icon: Package },
  { id: "contract", label: "Contrato do Professor", icon: FileSignature },
  { id: "contact", label: "Dados e Contatos", icon: Phone },
  { id: "doubts", label: "Dúvidas", icon: Headset },
  { id: "emails", label: "E-mails", icon: Mail },
  { id: "branding", label: "Identidade Visual", icon: Palette },
  { id: "teacher_goal", label: "Metas do Professor", icon: Target },
  { id: "pages", label: "Páginas Institucionais", icon: FileText },
  { id: "retention", label: "Retenção (Cupom)", icon: Heart },
  { id: "footer", label: "Rodapé", icon: PanelBottom },
  { id: "trial", label: "Teste Grátis", icon: Gift },
  { id: "twilio", label: "Verificação Celular", icon: Smartphone },
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
      {activeSection === "secondary" && (
        <SettingsHeroBanner
          settingsKey="secondary_banner"
          description="Banner exibido na página inicial (acima do rodapé) para quem NÃO está logado. Use uma mensagem de convite: conhecer a plataforma, criar conta, ver planos. O administrador vê os banners de aluno e professor em um carrossel automático."
        />
      )}
      {activeSection === "secondary_student" && (
        <SettingsHeroBanner
          settingsKey="secondary_banner_student"
          description="Banner exibido na página inicial (acima do rodapé) para alunos logados. Use uma mensagem para quem já estuda aqui: novos materiais, simulados, aula com professor, indicação de amigos."
        />
      )}
      {activeSection === "secondary_teacher" && (
        <SettingsHeroBanner
          settingsKey="secondary_banner_teacher"
          description="Banner exibido na página inicial (acima do rodapé) para professores logados. Use uma mensagem para o professor: publicar aulas, responder dúvidas, metas e ganhos."
        />
      )}
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
      {activeSection === "ai_generation" && <SettingsAiGeneration />}
      {activeSection === "doubts" && <SettingsDoubts />}
    </div>
  );
};

export default AdminSettingsTab;
