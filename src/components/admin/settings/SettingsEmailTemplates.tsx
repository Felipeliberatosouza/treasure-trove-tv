import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useStorageUpload } from "@/hooks/useStorageUpload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Upload, X, Eye, Mail } from "lucide-react";
import { toast } from "sonner";

interface EmailTemplate {
  id: string;
  template_key: string;
  subject: string;
  body_html: string;
  logo_url: string | null;
  show_social_footer: boolean;
}

const TEMPLATE_LABELS: Record<string, string> = {
  email_confirmation: "Confirmação de E-mail",
  welcome: "Boas-vindas",
  phone_verification: "Verificação por Celular",
  birthday: "Feliz Aniversário",
  doubt_approved: "Dúvida Aprovada (Professor)",
  doubt_answered: "Dúvida Respondida (Aluno)",
  doubt_submitted: "Dúvida Enviada (Aluno)",
};

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  email_confirmation: "Enviado após verificação do celular, contém link de confirmação de cadastro.",
  welcome: "Enviado após o usuário confirmar o cadastro pelo link de e-mail.",
  phone_verification: "Mensagem com código de verificação enviada por SMS/WhatsApp.",
  birthday: "Enviado automaticamente no dia do aniversário do usuário (diariamente às 8h).",
  doubt_approved: "Enviado ao professor quando uma dúvida de aluno é aprovada pelo administrador.",
  doubt_answered: "Enviado ao aluno quando o professor responde sua dúvida.",
  doubt_submitted: "Mensagem exibida ao aluno após enviar uma dúvida.",
};

const TEMPLATE_VARS: Record<string, string[]> = {
  email_confirmation: ["{{name}}", "{{confirmation_link}}"],
  welcome: ["{{name}}", "{{login_link}}"],
  phone_verification: ["{{name}}", "{{code}}", "{{channel}}"],
  birthday: ["{{name}}", "{{login_link}}"],
  doubt_approved: ["{{teacher_name}}", "{{student_name}}", "{{question}}", "{{content_title}}", "{{deadline_days}}"],
  doubt_answered: ["{{student_name}}", "{{teacher_name}}", "{{question}}", "{{answer}}", "{{content_title}}"],
  doubt_submitted: ["{{student_name}}"],
};

const SettingsEmailTemplates = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const { upload, uploading } = useStorageUpload("platform-assets");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: contactData } = usePlatformSettings("contact");
  const { data: brandingData } = usePlatformSettings("branding");

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at");

    if (error) {
      toast.error("Erro ao carregar templates de e-mail.");
    } else if (data) {
      setTemplates(data);
      if (!activeKey && data.length > 0) setActiveKey(data[0].template_key);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const active = templates.find((t) => t.template_key === activeKey);

  const updateField = (field: keyof EmailTemplate, value: string | boolean) => {
    setTemplates((prev) =>
      prev.map((t) => (t.template_key === activeKey ? { ...t, [field]: value } : t))
    );
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `email-logo/logo-${Date.now()}.${ext}`;
    const url = await upload(file, path);
    if (url) updateField("logo_url", url);
  };

  const handleSave = async () => {
    if (!active) return;
    setSaving(true);
    const { error } = await supabase
      .from("email_templates")
      .update({
        subject: active.subject,
        body_html: active.body_html,
        logo_url: active.logo_url,
        show_social_footer: active.show_social_footer,
      })
      .eq("id", active.id);

    if (error) toast.error("Erro ao salvar template.");
    else toast.success("Template salvo com sucesso!");
    setSaving(false);
  };

  const buildFooterHtml = () => {
    if (!contactData) return "";
    const lines: string[] = [];

    if (contactData.email) lines.push(`📧 ${contactData.email}`);
    if (contactData.phone) lines.push(`📞 ${contactData.phone}`);
    if (contactData.whatsapp) lines.push(`💬 WhatsApp: ${contactData.whatsapp}`);

    const socials: string[] = [];
    if (contactData.instagram) socials.push(`<a href="https://instagram.com/${contactData.instagram.replace("@", "")}" style="color:#6366f1;text-decoration:none;">Instagram</a>`);
    if (contactData.youtube) socials.push(`<a href="${contactData.youtube}" style="color:#6366f1;text-decoration:none;">YouTube</a>`);
    if (contactData.facebook) socials.push(`<a href="${contactData.facebook}" style="color:#6366f1;text-decoration:none;">Facebook</a>`);
    if (contactData.twitter) socials.push(`<a href="https://x.com/${contactData.twitter.replace("@", "")}" style="color:#6366f1;text-decoration:none;">X</a>`);
    if (contactData.tiktok) socials.push(`<a href="https://tiktok.com/@${contactData.tiktok.replace("@", "")}" style="color:#6366f1;text-decoration:none;">TikTok</a>`);
    if (contactData.linkedin) socials.push(`<a href="${contactData.linkedin}" style="color:#6366f1;text-decoration:none;">LinkedIn</a>`);

    return `
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <div style="text-align:center;font-size:12px;color:#6b7280;">
        ${lines.map((l) => `<p style="margin:4px 0;">${l}</p>`).join("")}
        ${socials.length > 0 ? `<p style="margin:8px 0;">${socials.join(" · ")}</p>` : ""}
        <p style="margin:8px 0;color:#9ca3af;">© ${new Date().getFullYear()} ${brandingData?.platform_name || "Revisão Fácil"}</p>
      </div>
    `;
  };

  const buildPreviewHtml = () => {
    if (!active) return "";
    const logoHtml = active.logo_url
      ? `<div style="text-align:center;margin-bottom:16px;"><img src="${active.logo_url}" alt="Logo" style="max-height:60px;max-width:200px;" /></div>`
      : "";
    const footerHtml = active.show_social_footer ? buildFooterHtml() : "";

    // Replace template vars with sample data
    let body = active.body_html
      .replace(/\{\{name\}\}/g, "João Silva")
      .replace(/\{\{confirmation_link\}\}/g, "#")
      .replace(/\{\{login_link\}\}/g, "#")
      .replace(/\{\{code\}\}/g, "123456")
      .replace(/\{\{channel\}\}/g, "SMS")
      .replace(/\{\{teacher_name\}\}/g, "Prof. Maria")
      .replace(/\{\{student_name\}\}/g, "João Silva")
      .replace(/\{\{question\}\}/g, "Como resolver essa equação?")
      .replace(/\{\{answer\}\}/g, "Você precisa aplicar a fórmula de Bhaskara...")
      .replace(/\{\{content_title\}\}/g, "Matemática - Equações")
      .replace(/\{\{deadline_days\}\}/g, "3");

    return `
      <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#ffffff;padding:24px;border-radius:8px;">
        ${logoHtml}
        ${body}
        ${footerHtml}
      </div>
    `;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Edite os templates de e-mail enviados pela plataforma. Os contatos e redes sociais do rodapé são puxados das configurações de Contato.
      </p>

      {/* Template selector tabs */}
      <div className="flex gap-2 flex-wrap">
        {templates.map((t) => (
          <button
            key={t.template_key}
            onClick={() => { setActiveKey(t.template_key); setPreviewing(false); }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              activeKey === t.template_key
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            {TEMPLATE_LABELS[t.template_key] || t.template_key}
          </button>
        ))}
      </div>

      {active && (
        <div className="space-y-4 max-w-2xl">
          {TEMPLATE_DESCRIPTIONS[activeKey] && (
            <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
              {TEMPLATE_DESCRIPTIONS[activeKey]}
            </p>
          )}

          {/* Logo */}
          <div className="space-y-2">
            <Label>Logomarca do E-mail</Label>
            {active.logo_url && (
              <div className="relative inline-block rounded-lg border border-border bg-muted/30 p-2">
                <img src={active.logo_url} alt="Logo" className="h-12 max-w-[180px] object-contain" />
                <button
                  onClick={() => updateField("logo_url", "")}
                  className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:opacity-80"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> {uploading ? "Enviando..." : "Enviar Imagem"}
              </Button>
              <Input
                value={active.logo_url || ""}
                onChange={(e) => updateField("logo_url", e.target.value)}
                placeholder="ou cole uma URL..."
                className="flex-1 text-xs"
              />
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>

          {/* Subject */}
          <div>
            <Label>Assunto</Label>
            <Input value={active.subject} onChange={(e) => updateField("subject", e.target.value)} />
          </div>

          {/* Body */}
          <div>
            <Label>Corpo do E-mail (HTML)</Label>
            <Textarea
              value={active.body_html}
              onChange={(e) => updateField("body_html", e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
            {TEMPLATE_VARS[activeKey] && (
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis disponíveis: {TEMPLATE_VARS[activeKey].join(", ")}
              </p>
            )}
          </div>

          {/* Social footer toggle */}
          <div className="flex items-center gap-3">
            <Switch
              checked={active.show_social_footer}
              onCheckedChange={(v) => updateField("show_social_footer", v)}
            />
            <Label className="cursor-pointer">Exibir contatos e redes sociais no rodapé</Label>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" onClick={() => setPreviewing(!previewing)}>
              <Eye className="h-4 w-4 mr-2" /> {previewing ? "Fechar Prévia" : "Prévia"}
            </Button>
          </div>

          {/* Preview */}
          {previewing && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                Prévia do E-mail — "{active.subject}"
              </div>
              <div
                className="bg-white p-4"
                dangerouslySetInnerHTML={{ __html: buildPreviewHtml() }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsEmailTemplates;
