import { useState, useEffect } from "react";
import { Settings, Palette, Phone, FileText, Star, Layout, Gift, FolderOpen, Mail, Package, FileSignature, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import TwoFactorSetup from "@/components/TwoFactorSetup";

const SecuritySection = () => {
  const [mandatory, setMandatory] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "admin_2fa_required")
      .maybeSingle()
      .then(({ data }) => {
        setMandatory(data?.value === true);
        setLoading(false);
      });
  }, []);

  const toggleMandatory = async (checked: boolean) => {
    setMandatory(checked);
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: JSON.parse(JSON.stringify(checked)) })
      .eq("key", "admin_2fa_required");
    if (error) {
      toast.error("Erro ao salvar configuração");
      setMandatory(!checked);
    } else {
      toast.success(checked ? "2FA obrigatório ativado para admins" : "2FA obrigatório desativado");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Autenticação de Dois Fatores (2FA)
        </h3>
        <TwoFactorSetup />
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Política de 2FA para Administradores
        </h3>
        <p className="text-sm text-muted-foreground">
          Quando ativado, todos os administradores serão obrigados a configurar a autenticação de dois fatores antes de acessar o painel administrativo.
        </p>
        <div className="flex items-center gap-3">
          <Switch
            id="mandatory-2fa"
            checked={mandatory}
            onCheckedChange={toggleMandatory}
            disabled={loading}
          />
          <Label htmlFor="mandatory-2fa" className="text-sm font-medium">
            Exigir 2FA obrigatório para todos os administradores
          </Label>
        </div>
      </div>
    </div>
  );
};

const sections = [
  { id: "branding", label: "Identidade Visual", icon: Palette },
  { id: "contact", label: "Dados e Contatos", icon: Phone },
  { id: "emails", label: "E-mails", icon: Mail },
  { id: "pages", label: "Páginas Institucionais", icon: FileText },
  { id: "hero", label: "Banner Principal", icon: Layout },
  { id: "teacher_banner", label: "Banner Professor", icon: Layout },
  { id: "featured", label: "Vídeos em Destaque", icon: Star },
  { id: "areas", label: "Áreas de Cursos", icon: FolderOpen },
  { id: "trial", label: "Teste Grátis", icon: Gift },
  { id: "products", label: "Config. de Produtos", icon: Package },
  { id: "contract", label: "Contrato do Professor", icon: FileSignature },
  { id: "security", label: "Segurança (2FA)", icon: ShieldCheck },
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
      {activeSection === "products" && <SettingsProductConfig />}
      {activeSection === "contract" && <SettingsTeacherContract />}
      {activeSection === "security" && <SecuritySection />}
    </div>
  );
};

export default AdminSettingsTab;
