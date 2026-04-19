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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Upload, X, Eye, Mail, Shield, Copy, Tag, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface EmailTemplate {
  id: string;
  template_key: string;
  subject: string;
  body_html: string;
  logo_url: string | null;
  show_social_footer: boolean;
  always_send: boolean;
  respect_marketing_preference: boolean;
  text_color: string;
  link_color: string;
  heading_color: string;
  button_color: string;
  font_family: string;
  use_uploaded_logo: boolean;
  coupon_enabled: boolean;
  coupon_code: string;
  coupon_message: string;
  coupon_expires_at: string | null;
  coupon_starts_at: string | null;
}

const TEMPLATE_LABELS: Record<string, string> = {
  email_confirmation: "Confirmação de E-mail",
  welcome: "Boas-vindas",
  phone_verification: "Verificação por Celular",
  birthday: "Aniversário",
  birthday_subscriber: "Aniversário",
  birthday_teacher: "Aniversário",
  reengagement_student: "Reengajamento",
  reengagement_teacher: "Reengajamento",
  doubt_approved: "Dúvida Aprovada (Professor)",
  doubt_answered: "Dúvida Respondida (Aluno)",
  doubt_submitted: "Dúvida Enviada (Aluno)",
  new_content: "Novo Conteúdo",
  payment_confirmation: "Confirmação de Pagamento",
  new_student_admin: "Novo Aluno (Admin)",
  new_teacher_admin: "Novo Professor (Admin)",
  content_approved: "Conteúdo Aprovado",
  content_rejected: "Conteúdo Rejeitado",
  contract_signed: "Contrato Assinado",
  subscription_expiring: "Lembrete de Vencimento",
  subscription_cancelled: "Assinatura Cancelada/Expirada",
};

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  email_confirmation: "Enviado após verificação do celular, contém link de confirmação de cadastro.",
  welcome: "Enviado após o usuário confirmar o cadastro pelo link de e-mail.",
  phone_verification: "Mensagem com código de verificação enviada por SMS/WhatsApp.",
  birthday: "Enviado no aniversário de ALUNOS SEM assinatura ativa (diariamente às 8h). Texto motivacional + vídeo recomendado da área de interesse + pode incluir cupom de desconto.",
  birthday_subscriber: "Enviado no aniversário de ALUNOS COM assinatura ativa (diariamente às 8h). Texto motivacional + vídeo recomendado da área de interesse. NÃO envia cupom.",
  birthday_teacher: "Enviado no aniversário de PROFESSORES (diariamente às 8h). Mensagem de parabéns e agradecimento pela parceria. NÃO envia cupom nem vídeo recomendado.",
  reengagement_student: "Enviado a ALUNOS que não acessam vídeos há 14+ dias (configurável). Inclui 3 vídeos mais assistidos das áreas de interesse que ele ainda não viu (com fallback global). Reenviado no máximo a cada 30 dias.",
  reengagement_teacher: "Enviado a PROFESSORES que não publicam conteúdo há 30+ dias (configurável). Inclui o desempenho atual (vídeos publicados, views) e simulação de ganhos em 3 cenários (Conservador/Realista/Otimista). Reenviado no máximo a cada 30 dias.",
  doubt_approved: "Enviado ao professor quando uma dúvida de aluno é aprovada pelo administrador.",
  doubt_answered: "Enviado ao aluno quando o professor responde sua dúvida.",
  doubt_submitted: "Mensagem exibida ao aluno após enviar uma dúvida.",
  new_content: "Enviado aos alunos quando um novo conteúdo é publicado na plataforma.",
  payment_confirmation: "Enviado ao aluno após pagamento aprovado (assinatura ou compra avulsa).",
  new_student_admin: "Notifica o administrador quando um novo aluno se cadastra.",
  new_teacher_admin: "Notifica o administrador quando um novo professor se cadastra.",
  content_approved: "Enviado ao professor quando seu conteúdo é aprovado pelo administrador.",
  content_rejected: "Enviado ao professor quando seu conteúdo precisa de ajustes.",
  contract_signed: "Confirmação enviada ao professor após assinar o contrato.",
  subscription_expiring: "Enviado automaticamente alguns dias antes do vencimento da assinatura do aluno.",
  subscription_cancelled: "Enviado ao aluno quando sua assinatura é cancelada ou expira.",
};

const TEMPLATE_VARS: Record<string, string[]> = {
  email_confirmation: ["{{name}}", "{{confirmation_link}}"],
  welcome: ["{{name}}", "{{login_link}}"],
  phone_verification: ["{{name}}", "{{code}}", "{{channel}}"],
  birthday: ["{{name}}", "{{login_link}}", "{{recommended_video_block}}"],
  birthday_subscriber: ["{{name}}", "{{login_link}}", "{{recommended_video_block}}"],
  birthday_teacher: ["{{name}}", "{{login_link}}"],
  reengagement_student: ["{{name}}", "{{login_link}}", "{{recommended_videos_block}}"],
  reengagement_teacher: ["{{name}}", "{{login_link}}", "{{teacher_stats_block}}", "{{teacher_scenarios_block}}", "{{total_videos}}", "{{total_views}}"],
  doubt_approved: ["{{teacher_name}}", "{{student_name}}", "{{question}}", "{{content_title}}", "{{deadline_days}}"],
  doubt_answered: ["{{student_name}}", "{{teacher_name}}", "{{question}}", "{{answer}}", "{{content_title}}"],
  doubt_submitted: ["{{student_name}}"],
  new_content: ["{{name}}", "{{content_title}}", "{{teacher_name}}", "{{content_type}}", "{{content_link}}"],
  payment_confirmation: ["{{name}}", "{{plan_name}}", "{{amount}}", "{{payment_date}}", "{{dashboard_link}}"],
  new_student_admin: ["{{student_name}}", "{{student_email}}", "{{signup_date}}"],
  new_teacher_admin: ["{{teacher_name}}", "{{teacher_email}}", "{{expertise_area}}", "{{signup_date}}"],
  content_approved: ["{{teacher_name}}", "{{content_title}}", "{{content_type}}", "{{dashboard_link}}"],
  content_rejected: ["{{teacher_name}}", "{{content_title}}", "{{rejection_reason}}", "{{dashboard_link}}"],
  contract_signed: ["{{teacher_name}}", "{{signed_date}}", "{{expiry_date}}", "{{dashboard_link}}"],
  subscription_expiring: ["{{name}}", "{{plan_name}}", "{{days_remaining}}", "{{expiry_date}}", "{{subscription_status}}", "{{renew_link}}"],
  subscription_cancelled: ["{{name}}", "{{plan_name}}", "{{expiry_date}}", "{{reason}}", "{{renew_link}}"],
};

const FONT_OPTIONS = [
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "'Helvetica Neue', Helvetica, sans-serif", label: "Helvetica" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "Tahoma, sans-serif", label: "Tahoma" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS" },
  { value: "'Courier New', monospace", label: "Courier New" },
];

const SettingsEmailTemplates = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);
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
      setTemplates(data as unknown as EmailTemplate[]);
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

  const couponDateRangeInvalid = !!(
    active?.coupon_enabled &&
    active?.coupon_starts_at &&
    active?.coupon_expires_at &&
    new Date(active.coupon_starts_at).getTime() >=
      new Date(active.coupon_expires_at).getTime()
  );

  const couponExpiresInPast = !!(
    active?.coupon_enabled &&
    active?.coupon_expires_at &&
    new Date(active.coupon_expires_at).getTime() < Date.now()
  );

  const couponCodeMissing = !!(
    active?.coupon_enabled && !active?.coupon_code?.trim()
  );

  const COUPON_CODE_REGEX = /^[A-Z0-9_-]+$/;
  const couponCodeHasInvalidChars = !!(
    active?.coupon_enabled &&
    active?.coupon_code &&
    active.coupon_code.trim() &&
    !COUPON_CODE_REGEX.test(active.coupon_code.trim())
  );

  const generateCouponCode = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I para evitar confusão
    const length = 8;
    let code = "";
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const buf = new Uint32Array(length);
      crypto.getRandomValues(buf);
      for (let i = 0; i < length; i++) {
        code += alphabet[buf[i] % alphabet.length];
      }
    } else {
      for (let i = 0; i < length; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    }
    updateField("coupon_code", code);
    toast.success(`Código gerado: ${code}`);
  };

  const handleSave = async () => {
    if (!active) return;
    if (couponCodeMissing) {
      toast.error(
        "Informe o código do cupom ou desabilite o cupom antes de salvar."
      );
      return;
    }
    if (couponCodeHasInvalidChars) {
      toast.error(
        "O código do cupom contém caracteres inválidos. Use apenas letras, números, hífen e underline."
      );
      return;
    }
    if (couponDateRangeInvalid) {
      toast.error(
        "A data de início do cupom deve ser anterior à data de expiração."
      );
      return;
    }
    if (couponExpiresInPast) {
      toast.error(
        "A data de expiração do cupom está no passado. O cupom nunca será exibido nos e-mails."
      );
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("email_templates")
      .update({
        subject: active.subject,
        body_html: active.body_html,
        logo_url: active.logo_url,
        show_social_footer: active.show_social_footer,
        always_send: active.always_send,
        respect_marketing_preference: active.respect_marketing_preference,
        text_color: active.text_color,
        link_color: active.link_color,
        heading_color: active.heading_color,
        button_color: active.button_color,
        font_family: active.font_family,
        use_uploaded_logo: active.use_uploaded_logo,
        coupon_enabled: active.coupon_enabled,
        coupon_code: active.coupon_code,
        coupon_message: active.coupon_message,
        coupon_expires_at: active.coupon_expires_at,
        coupon_starts_at: active.coupon_starts_at,
      } as any)
      .eq("id", active.id);

    if (error) toast.error("Erro ao salvar template.");
    else toast.success("Template salvo com sucesso!");
    setSaving(false);
  };

  const handleApplyStyleToAll = async () => {
    if (!active) return;
    const confirmApply = window.confirm(
      `Deseja aplicar o estilo visual de "${TEMPLATE_LABELS[activeKey] || activeKey}" a todos os outros templates? Isso sobrescreverá as cores, fonte e logo de todos os templates.`
    );
    if (!confirmApply) return;

    setApplyingAll(true);
    const styleFields = {
      text_color: active.text_color,
      link_color: active.link_color,
      heading_color: active.heading_color,
      button_color: active.button_color,
      font_family: active.font_family,
      logo_url: active.logo_url,
      use_uploaded_logo: active.use_uploaded_logo,
    };

    const { error } = await supabase
      .from("email_templates")
      .update(styleFields as any)
      .neq("id", active.id);

    if (error) {
      toast.error("Erro ao aplicar estilo aos outros templates.");
    } else {
      setTemplates((prev) =>
        prev.map((t) => (t.id === active.id ? t : { ...t, ...styleFields }))
      );
      toast.success("Estilo visual aplicado a todos os templates!");
    }
    setApplyingAll(false);
  };

  const buildFooterHtml = () => {
    if (!contactData || !active) return "";
    const linkColor = active.link_color || "#6366f1";
    const lines: string[] = [];

    if (contactData.email) lines.push(`📧 ${contactData.email}`);
    if (contactData.phone) lines.push(`📞 ${contactData.phone}`);
    if (contactData.whatsapp) lines.push(`💬 WhatsApp: ${contactData.whatsapp}`);

    const socials: string[] = [];
    if (contactData.instagram) socials.push(`<a href="https://instagram.com/${contactData.instagram.replace("@", "")}" style="color:${linkColor};text-decoration:none;">Instagram</a>`);
    if (contactData.youtube) socials.push(`<a href="${contactData.youtube}" style="color:${linkColor};text-decoration:none;">YouTube</a>`);
    if (contactData.facebook) socials.push(`<a href="${contactData.facebook}" style="color:${linkColor};text-decoration:none;">Facebook</a>`);
    if (contactData.twitter) socials.push(`<a href="https://x.com/${contactData.twitter.replace("@", "")}" style="color:${linkColor};text-decoration:none;">X</a>`);
    if (contactData.tiktok) socials.push(`<a href="https://tiktok.com/@${contactData.tiktok.replace("@", "")}" style="color:${linkColor};text-decoration:none;">TikTok</a>`);
    if (contactData.linkedin) socials.push(`<a href="${contactData.linkedin}" style="color:${linkColor};text-decoration:none;">LinkedIn</a>`);

    return `
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <div style="text-align:center;font-size:12px;color:#6b7280;">
        ${lines.map((l) => `<p style="margin:4px 0;">${l}</p>`).join("")}
        ${socials.length > 0 ? `<p style="margin:8px 0;">${socials.join(" · ")}</p>` : ""}
        <p style="margin:8px 0;color:#9ca3af;">© ${new Date().getFullYear()} ${brandingData?.platform_name || "Revisão Fácil"}</p>
      </div>
    `;
  };

  const buildAlwaysSendFooter = () => {
    if (!active || !active.always_send) return "";
    const linkColor = active.link_color || "#6366f1";
    const textColor = active.text_color || "#333333";
    const platformName = brandingData?.platform_name || "Revisão Fácil";
    const subject = active.subject || "serviço solicitado";

    const securityUrl = `${window.location.origin}/email-seguranca?email=usuario@exemplo.com&template=${active.template_key}&subject=${encodeURIComponent(subject)}`;

    return `
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:${textColor};line-height:1.6;">
        <p style="margin:0;">
          Este e-mail foi enviado por <a href="https://revisaofacil.com" style="color:${linkColor};text-decoration:none;font-weight:600;">${platformName}</a> para atender ao seu pedido de: <strong>${subject}</strong>.
          Se você não fez esse pedido, pedimos desculpas. Neste caso, por favor clique em: 
          <a href="${securityUrl}" style="color:${linkColor};text-decoration:underline;">eu não solicitei esse e-mail.</a>
        </p>
      </div>
    `;
  };

  const buildPreviewHtml = () => {
    if (!active) return "";
    const textColor = active.text_color || "#333333";
    const headingColor = active.heading_color || "#dc2626";
    const buttonColor = active.button_color || "#6366f1";
    const fontFamily = active.font_family || "Arial, sans-serif";

    const platformName = brandingData?.platform_name || "Revisão Fácil";
    let logoHtml = "";
    if (active.use_uploaded_logo && active.logo_url) {
      logoHtml = `<div style="text-align:center;margin-bottom:16px;"><img src="${active.logo_url}" alt="Logo" style="max-height:60px;max-width:200px;" /></div>`;
    } else {
      logoHtml = `<div style="text-align:center;margin-bottom:16px;font-size:24px;font-weight:bold;color:${headingColor};">${platformName}</div>`;
    }

    const footerHtml = active.show_social_footer ? buildFooterHtml() : "";
    const alwaysSendFooter = buildAlwaysSendFooter();

    let couponHtml = "";
    const nowMs = Date.now();
    const couponExpired = active.coupon_expires_at
      ? new Date(active.coupon_expires_at).getTime() < nowMs
      : false;
    const couponNotStarted = active.coupon_starts_at
      ? new Date(active.coupon_starts_at).getTime() > nowMs
      : false;
    if (
      active.coupon_enabled &&
      !couponExpired &&
      !couponNotStarted &&
      (active.coupon_code || active.coupon_message)
    ) {
      const safe = (s: string) =>
        String(s ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      const code = safe(active.coupon_code || "");
      const message = safe(active.coupon_message || "");
      couponHtml = `
        <div style="margin:24px auto;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:2px dashed #d97706;border-radius:12px;padding:20px 24px;text-align:center;">
          ${message ? `<p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#7c2d12;line-height:1.4;">${message}</p>` : ""}
          ${code ? `<div style="display:inline-block;background:#ffffff;border:2px solid #d97706;border-radius:8px;padding:12px 24px;font-size:22px;font-weight:800;letter-spacing:2px;color:#7c2d12;font-family:'Courier New',monospace;">${code}</div>` : ""}
          <p style="margin:12px 0 0;font-size:12px;color:#92400e;">Use este cupom em sua próxima assinatura</p>
        </div>
      `;
    }

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

    // Apply heading color to h1, h2, h3 tags in body
    body = body.replace(/<h([1-3])([^>]*)>/gi, (match, level, attrs) => {
      if (attrs.includes('style=')) {
        return match.replace(/color:[^;"']*/i, `color:${headingColor}`);
      }
      return `<h${level}${attrs} style="color:${headingColor};">`;
    });

    // Apply button color to elements with button-like styling
    body = body.replace(/background-color:\s*#[0-9a-fA-F]{3,6}/gi, `background-color:${buttonColor}`);
    body = body.replace(/background:\s*#[0-9a-fA-F]{3,6}/gi, `background:${buttonColor}`);

    return `
      <div style="max-width:600px;margin:0 auto;font-family:${fontFamily};background:#ffffff;padding:24px;border-radius:8px;color:${textColor};">
        ${logoHtml}
        ${body}
        ${couponHtml}
        ${footerHtml}
        ${alwaysSendFooter}
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
            {t.template_key === "birthday" && (
              <span
                className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  activeKey === t.template_key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                }`}
                title="Aluno SEM assinatura ativa. Inclui vídeo recomendado e pode ter cupom."
              >
                Aluno sem assinatura
              </span>
            )}
            {t.template_key === "birthday_subscriber" && (
              <span
                className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  activeKey === t.template_key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                }`}
                title="Aluno COM assinatura ativa. Inclui vídeo recomendado. Não envia cupom."
              >
                Aluno assinante
              </span>
            )}
            {t.template_key === "birthday_teacher" && (
              <span
                className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  activeKey === t.template_key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                }`}
                title="Enviado a professores. Mensagem de agradecimento. Não envia cupom."
              >
                Professor
              </span>
            )}
            {t.template_key === "reengagement_student" && (
              <span
                className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  activeKey === t.template_key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                }`}
                title="Aluno inativo há 14+ dias. Inclui 3 vídeos recomendados."
              >
                Aluno inativo
              </span>
            )}
            {t.template_key === "reengagement_teacher" && (
              <span
                className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  activeKey === t.template_key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400"
                }`}
                title="Professor sem postar há 30+ dias. Inclui stats e simulação de ganhos."
              >
                Professor inativo
              </span>
            )}
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

          {/* Send control flags */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" /> Controle de Envio
            </h4>

            <div className="flex items-center gap-3">
              <Switch
                checked={active.always_send}
                onCheckedChange={(v) => updateField("always_send", v)}
              />
              <div>
                <Label className="cursor-pointer text-sm">Sempre enviar (obrigatório)</Label>
                <p className="text-xs text-muted-foreground">
                  Envia independente da preferência de marketing do usuário. Adiciona rodapé de segurança.
                </p>
              </div>
            </div>

            {!active.always_send && (
              <div className="flex items-center gap-3">
                <Switch
                  checked={active.respect_marketing_preference}
                  onCheckedChange={(v) => updateField("respect_marketing_preference", v)}
                />
                <div>
                  <Label className="cursor-pointer text-sm">Respeitar preferência de marketing</Label>
                  <p className="text-xs text-muted-foreground">
                    Só envia se o usuário aceitou receber comunicações no cadastro.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Cupom de Desconto — não disponível para assinantes ativos nem para professores */}
          {(activeKey === "birthday_subscriber" || activeKey === "birthday_teacher") ? (
            <div className="rounded-lg border border-border p-4 space-y-2 bg-muted/30">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Tag className="h-4 w-4" /> Cupom de Desconto
              </h4>
              <p className="text-xs text-muted-foreground">
                {activeKey === "birthday_subscriber"
                  ? <>Este template é destinado a alunos que <strong>já possuem assinatura ativa</strong>. Por isso, não é possível incluir cupom de desconto. Para enviar cupom no aniversário, use o template <strong>"Aniversário (Aluno sem assinatura)"</strong>.</>
                  : <>Este template é destinado a <strong>professores</strong>. Não é possível incluir cupom de desconto neste e-mail.</>
                }
              </p>
            </div>
          ) : (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4" /> Cupom de Desconto
            </h4>

            <div className="flex items-center gap-3">
              <Switch
                checked={active.coupon_enabled}
                onCheckedChange={(v) => updateField("coupon_enabled", v)}
              />
              <div>
                <Label className="cursor-pointer text-sm">Incluir cupom de desconto neste e-mail</Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativo, um bloco em destaque com a frase e o código será adicionado ao final do e-mail.
                </p>
              </div>
            </div>

            {active.coupon_enabled && (
              <div className="space-y-3 pt-1">
                <div>
                  <Label className="text-xs">Código do cupom</Label>
                  <div className="flex gap-2">
                    <Input
                      value={active.coupon_code || ""}
                      onChange={(e) => updateField("coupon_code", e.target.value.toUpperCase())}
                      placeholder="Ex: VOLTA20"
                      maxLength={40}
                      className={`uppercase tracking-wider font-mono ${
                        couponCodeMissing || couponCodeHasInvalidChars
                          ? "border-destructive ring-1 ring-destructive focus-visible:ring-destructive"
                          : ""
                      }`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generateCouponCode}
                      title="Gerar código aleatório de 8 caracteres"
                      className="shrink-0 gap-1"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span className="hidden sm:inline">Gerar</span>
                    </Button>
                  </div>
                  {couponCodeMissing && (
                    <p className="text-xs mt-1 text-destructive font-semibold flex items-start gap-1">
                      <span>⚠️</span>
                      <span>
                        O código do cupom é obrigatório quando o cupom está
                        habilitado. Informe um código ou desabilite o cupom.
                      </span>
                    </p>
                  )}
                  {!couponCodeMissing && couponCodeHasInvalidChars && (
                    <p className="text-xs mt-1 text-destructive font-semibold flex items-start gap-1">
                      <span>⚠️</span>
                      <span>
                        O código do cupom contém caracteres inválidos. Use
                        apenas letras (A-Z), números (0-9), hífen (-) e
                        underline (_).
                      </span>
                    </p>
                  )}
                  {!couponCodeMissing && !couponCodeHasInvalidChars && (
                    <p className="text-xs mt-1 text-muted-foreground">
                      Permitido: letras, números, hífen (-) e underline (_).
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Frase do cupom</Label>
                  <Textarea
                    value={active.coupon_message || ""}
                    onChange={(e) => updateField("coupon_message", e.target.value)}
                    placeholder="Ex: Aproveite 20% de desconto na sua próxima assinatura usando o cupom abaixo:"
                    rows={2}
                    maxLength={300}
                  />
                </div>
                <div>
                  <Label className="text-xs">Válido a partir de (opcional)</Label>
                  <Input
                    type="datetime-local"
                    value={
                      active.coupon_starts_at
                        ? new Date(
                            new Date(active.coupon_starts_at).getTime() -
                              new Date().getTimezoneOffset() * 60000
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      updateField(
                        "coupon_starts_at" as any,
                        v ? new Date(v).toISOString() : null
                      );
                    }}
                    className={
                      couponDateRangeInvalid
                        ? "border-destructive ring-1 ring-destructive focus-visible:ring-destructive"
                        : ""
                    }
                  />
                  {active.coupon_starts_at && (
                    <p
                      className={`text-xs mt-1 ${
                        new Date(active.coupon_starts_at).getTime() > Date.now()
                          ? "text-amber-600 font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {new Date(active.coupon_starts_at).getTime() > Date.now()
                        ? `⏳ Cupom só será exibido a partir de ${new Date(
                            active.coupon_starts_at
                          ).toLocaleString("pt-BR")}.`
                        : `Cupom ativo desde ${new Date(
                            active.coupon_starts_at
                          ).toLocaleString("pt-BR")}.`}
                    </p>
                  )}
                  {!active.coupon_starts_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Deixe em branco para começar imediatamente.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Data de expiração (opcional)</Label>
                  <Input
                    type="datetime-local"
                    value={
                      active.coupon_expires_at
                        ? new Date(
                            new Date(active.coupon_expires_at).getTime() -
                              new Date().getTimezoneOffset() * 60000
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      updateField(
                        "coupon_expires_at" as any,
                        v ? new Date(v).toISOString() : null
                      );
                    }}
                    className={
                      couponDateRangeInvalid || couponExpiresInPast
                        ? "border-destructive ring-1 ring-destructive focus-visible:ring-destructive"
                        : ""
                    }
                  />
                  {active.coupon_expires_at && (
                    <p
                      className={`text-xs mt-1 ${
                        new Date(active.coupon_expires_at).getTime() < Date.now()
                          ? "text-destructive font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {new Date(active.coupon_expires_at).getTime() < Date.now()
                        ? "⚠️ Cupom expirado — não será incluído nos e-mails enviados."
                        : `Cupom será ocultado automaticamente após ${new Date(
                            active.coupon_expires_at
                          ).toLocaleString("pt-BR")}.`}
                    </p>
                  )}
                  {!active.coupon_expires_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Deixe em branco para o cupom não expirar.
                    </p>
                  )}
                </div>
                {couponDateRangeInvalid && (
                  <div className="rounded-md border-2 border-destructive bg-destructive/10 p-3">
                    <p className="text-sm font-semibold text-destructive flex items-start gap-2">
                      <span>⚠️</span>
                      <span>
                        A data de início do cupom deve ser anterior à data de
                        expiração. Corrija as datas antes de salvar.
                      </span>
                    </p>
                  </div>
                )}
                {couponExpiresInPast && !couponDateRangeInvalid && (
                  <div className="rounded-md border-2 border-destructive bg-destructive/10 p-3">
                    <p className="text-sm font-semibold text-destructive flex items-start gap-2">
                      <span>⚠️</span>
                      <span>
                        A data de expiração está no passado. Se salvar agora, o
                        cupom <strong>nunca será exibido</strong> nos e-mails
                        enviados. Atualize a data de expiração para uma data
                        futura.
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* Logo */}
          <div className="space-y-2">
            <Label>Logomarca do E-mail</Label>
            <div className="flex items-center gap-3 mb-2">
              <Switch
                checked={active.use_uploaded_logo}
                onCheckedChange={(v) => updateField("use_uploaded_logo", v)}
              />
              <Label className="cursor-pointer text-sm">
                {active.use_uploaded_logo ? "Usar imagem de logomarca" : "Usar logomarca em texto da plataforma"}
              </Label>
            </div>

            {active.use_uploaded_logo && (
              <>
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
              </>
            )}
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h4 className="text-sm font-semibold">Estilo Visual</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Cor do Texto</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={active.text_color || "#333333"}
                    onChange={(e) => updateField("text_color", e.target.value)}
                    className="w-8 h-8 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={active.text_color || "#333333"}
                    onChange={(e) => updateField("text_color", e.target.value)}
                    className="flex-1 text-xs"
                    maxLength={7}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Cor do Título</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={active.heading_color || "#dc2626"}
                    onChange={(e) => updateField("heading_color", e.target.value)}
                    className="w-8 h-8 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={active.heading_color || "#dc2626"}
                    onChange={(e) => updateField("heading_color", e.target.value)}
                    className="flex-1 text-xs"
                    maxLength={7}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Cor dos Links</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={active.link_color || "#6366f1"}
                    onChange={(e) => updateField("link_color", e.target.value)}
                    className="w-8 h-8 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={active.link_color || "#6366f1"}
                    onChange={(e) => updateField("link_color", e.target.value)}
                    className="flex-1 text-xs"
                    maxLength={7}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Cor dos Botões</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={active.button_color || "#6366f1"}
                    onChange={(e) => updateField("button_color", e.target.value)}
                    className="w-8 h-8 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={active.button_color || "#6366f1"}
                    onChange={(e) => updateField("button_color", e.target.value)}
                    className="flex-1 text-xs"
                    maxLength={7}
                  />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={applyingAll}
              onClick={handleApplyStyleToAll}
            >
              <Copy className="h-4 w-4 mr-1" />
              {applyingAll ? "Aplicando..." : "Aplicar este estilo a todos os templates"}
            </Button>
          </div>
              <div>
                <Label className="text-xs">Fonte</Label>
                <Select
                  value={active.font_family || "Arial, sans-serif"}
                  onValueChange={(v) => updateField("font_family", v)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value} className="text-xs">
                        <span style={{ fontFamily: f.value }}>{f.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
            <Button onClick={handleSave} disabled={saving || couponDateRangeInvalid || couponExpiresInPast || couponCodeMissing || couponCodeHasInvalidChars}>
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
