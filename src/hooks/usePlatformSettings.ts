import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface BrandingSettings {
  platform_name: string;
  slogan: string;
  logo_url: string;
  /** Favicon PNG do site (ícone exibido na aba do navegador, favoritos e
   *  atalhos). Recomenda-se PNG quadrado de 512×512. Quando ausente, o
   *  favicon padrão embarcado no build é utilizado. */
  favicon_url?: string;
  /** Variante da logomarca para uso sobre fundos ESCUROS (geralmente uma
   *  versão clara/branca da logo). Quando ausente, cai para `logo_url`. */
  logo_url_dark_bg?: string;
  /** Variante da logomarca para uso sobre fundos CLAROS (geralmente uma
   *  versão escura/colorida da logo). Quando ausente, cai para `logo_url`. */
  logo_url_light_bg?: string;
  /** Qual das duas variações (logomarca para fundo escuro ou para fundo
   *  claro) deve ser usada como padrão em todo o site. Default: 'dark_bg'. */
  default_logo_variant?: "dark_bg" | "light_bg";
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  slogan_color: string;
  button_text_color: string;
  /** When true, always show the platform name as text instead of the uploaded
   *  logo image. Falls back to text automatically if `logo_url` is empty. */
  use_text_logo: boolean;
  /** Background color of primary CTAs (main buttons). */
  primary_button_bg: string;
  /** Text color rendered on top of primary CTAs. */
  primary_button_text: string;
  /** Background color of primary CTAs when hovered by the cursor. */
  primary_button_hover_bg?: string;
  /** Text color of primary CTAs when hovered by the cursor. */
  primary_button_hover_text?: string;
  /** Background color of secondary CTAs. */
  secondary_button_bg: string;
  /** Text color rendered on top of secondary CTAs. */
  secondary_button_text: string;
  /** Background color of secondary CTAs when hovered by the cursor. */
  secondary_button_hover_bg?: string;
  /** Text color of secondary CTAs when hovered by the cursor. */
  secondary_button_hover_text?: string;
  /** Background color of selection buttons (e.g. tag-style multi-choice chips) when idle. */
  selection_button_bg?: string;
  /** Text color of selection buttons when idle. */
  selection_button_text?: string;
  /** Background color of selection buttons when selected/active. */
  selection_button_selected_bg?: string;
  /** Text color of selection buttons when selected/active. */
  selection_button_selected_text?: string;
  /** Background color of single-line text fields (Input). */
  input_bg?: string;
  /** Foreground/text color of single-line text fields (Input). */
  input_text?: string;
  /** Border color of single-line text fields (Input). */
  input_border?: string;
  /** Background color of multi-line text areas (Textarea / observation boxes). */
  textarea_bg?: string;
  /** Foreground/text color of multi-line text areas. */
  textarea_text?: string;
  /** Border color of multi-line text areas. */
  textarea_border?: string;
  /** Background color of banner navigation buttons (prev/next arrows). */
  banner_nav_bg?: string;
  /** Icon (chevron) color inside banner navigation buttons. */
  banner_nav_icon?: string;
  /** Active pagination dot color below banners. */
  banner_nav_dot_active?: string;
  /** Idle pagination dot color below banners. */
  banner_nav_dot_idle?: string;
}

/** Resolve a logomarca padrão do site conforme o seletor configurado em
 *  Configurações → Identidade Visual → Gestão de Logomarca. Cai para a logo
 *  legada (`logo_url`) quando a variante selecionada não estiver definida. */
export function resolveDefaultLogoUrl(
  branding: Pick<
    BrandingSettings,
    "logo_url" | "logo_url_dark_bg" | "logo_url_light_bg" | "default_logo_variant"
  > | null | undefined,
): string {
  if (!branding) return "";
  const variant = branding.default_logo_variant === "light_bg"
    ? branding.logo_url_light_bg
    : branding.logo_url_dark_bg;
  return variant || branding.logo_url || "";
}

/** Luminância relativa (WCAG) de um HEX; retorna null quando inválido. */
function hexLuminanceInternal(hex: string): number | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * ch(parseInt(m[1], 16)) +
    0.7152 * ch(parseInt(m[2], 16)) +
    0.0722 * ch(parseInt(m[3], 16))
  );
}

/** Retorna 'light' quando o HEX informado for uma cor clara, 'dark' caso
 *  contrário. Usa o limite de 0.5 de luminância WCAG. */
export function detectThemeMode(hex: string | undefined | null): "light" | "dark" {
  if (!hex) return "dark";
  const lum = hexLuminanceInternal(hex);
  if (lum == null) return "dark";
  return lum > 0.5 ? "light" : "dark";
}

/** Escolhe a variante da logomarca mais adequada ao plano de fundo atual do
 *  site. Se a cor de fundo configurada em Identidade Visual for clara, usa a
 *  logomarca "para fundo claro"; se for escura, usa a "para fundo escuro".
 *  Cai para a logomarca legada (`logo_url`) quando a variante ideal não foi
 *  enviada pelo admin. */
export function resolveLogoForBackground(
  branding: Pick<
    BrandingSettings,
    "logo_url" | "logo_url_dark_bg" | "logo_url_light_bg" | "background_color" | "default_logo_variant"
  > | null | undefined,
): string {
  if (!branding) return "";
  const mode = detectThemeMode(branding.background_color);
  const preferred = mode === "light" ? branding.logo_url_light_bg : branding.logo_url_dark_bg;
  const fallback = mode === "light" ? branding.logo_url_dark_bg : branding.logo_url_light_bg;
  return preferred || fallback || branding.logo_url || "";
}

export interface ContactSettings {
  email: string;
  phone: string;
  address: string;
  platform_address: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  instagram: string;
  youtube: string;
  facebook: string;
  twitter: string;
  tiktok: string;
  linkedin: string;
  whatsapp: string;
  whatsapp_message: string;
  whatsapp_hours: string;
}

export interface SupportSettings {
  email: string;
  phone: string;
  whatsapp: string;
  whatsapp_message: string;
}

export type HeroColorScheme = "light" | "dark" | "accent";

export interface HeroBannerSettings {
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  banner_image_url?: string;
  /** Visual scheme used by the secondary banner. Ignored by the main hero. */
  color_scheme?: HeroColorScheme;
  /** Optional ISO datetime string. When set, the slide only appears at/after this moment. */
  starts_at?: string;
  /** Optional ISO datetime string. When set, the slide stops appearing at this moment. */
  ends_at?: string;
}

export interface HeroBannerCarouselSettings {
  slides: HeroBannerSettings[];
  autoplay_seconds: number;
  /** Optional toggle. When false, the section is hidden entirely.
   *  Used by the secondary banner (per role); the main hero ignores it. */
  enabled?: boolean;
}

export const MAX_HERO_SLIDES = 5;
export const DEFAULT_HERO_AUTOPLAY_SECONDS = 6;

export const emptyHeroSlide = (): HeroBannerSettings => ({
  title: "",
  subtitle: "",
  cta_text: "",
  cta_link: "",
  banner_image_url: "",
  color_scheme: "light",
  starts_at: "",
  ends_at: "",
});

/** Returns true when a slide should be visible right now according to its
 *  optional schedule window. Empty/invalid dates are treated as "no bound". */
export const isSlideScheduledNow = (
  slide: Pick<HeroBannerSettings, "starts_at" | "ends_at">,
  now: Date = new Date()
): boolean => {
  const t = now.getTime();
  if (slide.starts_at) {
    const start = Date.parse(slide.starts_at);
    if (!Number.isNaN(start) && t < start) return false;
  }
  if (slide.ends_at) {
    const end = Date.parse(slide.ends_at);
    if (!Number.isNaN(end) && t > end) return false;
  }
  return true;
};

export type SlideScheduleStatus = "always" | "scheduled" | "active" | "expired";

/** Classifies a slide's schedule window relative to `now`. */
export const getSlideScheduleStatus = (
  slide: Pick<HeroBannerSettings, "starts_at" | "ends_at">,
  now: Date = new Date()
): SlideScheduleStatus => {
  const t = now.getTime();
  const startRaw = slide.starts_at ? Date.parse(slide.starts_at) : NaN;
  const endRaw = slide.ends_at ? Date.parse(slide.ends_at) : NaN;
  const hasStart = !Number.isNaN(startRaw);
  const hasEnd = !Number.isNaN(endRaw);
  if (!hasStart && !hasEnd) return "always";
  if (hasEnd && t > endRaw) return "expired";
  if (hasStart && t < startRaw) return "scheduled";
  return "active";
};

/** Coerces legacy single-slide shape `{ title, subtitle, ... }` into the new
 *  carousel shape `{ slides: [...], autoplay_seconds }`. Safe to call on
 *  already-migrated data. */
export const normalizeHeroCarousel = (
  raw: unknown
): HeroBannerCarouselSettings => {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.slides)) {
      const slides = (obj.slides as HeroBannerSettings[])
        .filter((s) => s && typeof s === "object")
        .slice(0, MAX_HERO_SLIDES);
      return {
        slides: slides.length > 0 ? slides : [emptyHeroSlide()],
        autoplay_seconds:
          typeof obj.autoplay_seconds === "number" && obj.autoplay_seconds > 0
            ? obj.autoplay_seconds
            : DEFAULT_HERO_AUTOPLAY_SECONDS,
        enabled: typeof obj.enabled === "boolean" ? obj.enabled : true,
      };
    }
    if (
      "title" in obj ||
      "subtitle" in obj ||
      "cta_text" in obj ||
      "banner_image_url" in obj
    ) {
      return {
        slides: [
          {
            title: (obj.title as string) ?? "",
            subtitle: (obj.subtitle as string) ?? "",
            cta_text: (obj.cta_text as string) ?? "",
            cta_link: (obj.cta_link as string) ?? "",
            banner_image_url: (obj.banner_image_url as string) ?? "",
          },
        ],
        autoplay_seconds: DEFAULT_HERO_AUTOPLAY_SECONDS,
        enabled: true,
      };
    }
  }
  return {
    slides: [emptyHeroSlide()],
    autoplay_seconds: DEFAULT_HERO_AUTOPLAY_SECONDS,
    enabled: true,
  };
};

export interface FeaturedVideosSettings {
  video_ids: string[];
  section_title: string;
  section_subtitle: string;
}

export interface SubscriptionPlan {
  name: string;
  price: number;
  features: string[];
  highlighted: boolean;
}

export interface SubscriptionPlansSettings {
  plans: SubscriptionPlan[];
}

export interface VideoPricingSettings {
  default_lesson_price: number;
  default_exam_solution_price: number;
  allow_free_content: boolean;
}

export interface FreeTrialSettings {
  enabled: boolean;
  trial_type: "days" | "videos";
  trial_days: number;
  trial_videos: number;
  /** Percentual mínimo de progresso de vídeo (0-100) para que uma
   *  visualização seja contabilizada nas estatísticas públicas
   *  (KPIs, contagens em perfis e listas). Default: 70. */
  min_view_percent?: number;
}

export interface PageContentSettings {
  content: string;
}

export interface AboutUsSettings {
  description: string;
  mission: string;
  values: string;
  how_it_works_items: {
    title: string;
    description: string;
  }[];
}

export interface TermsOfUseSettings {
  sections: {
    title: string;
    content: string;
  }[];
}

export interface PrivacyPolicySettings {
  sections: {
    title: string;
    content: string;
  }[];
}

export interface FooterSettings {
  /** Use {platform_name} as a placeholder to insert the platform name. */
  copyright: string;
  about_label: string;
  about_url: string;
  terms_label: string;
  terms_url: string;
  privacy_label: string;
  privacy_url: string;
  contact_label: string;
  contact_url: string;
}

export interface AlertBoxSettings {
  bg_color: string;
  border_color: string;
  title_color: string;
  item_color: string;
}

export const DEFAULT_ALERT_BOX_SETTINGS: AlertBoxSettings = {
  bg_color: "#CA8A04",
  border_color: "#CA8A04",
  title_color: "#FFFFFF",
  item_color: "#F87171",
};

export const DEFAULT_FOOTER_SETTINGS: FooterSettings = {
  copyright: "© 2026 {platform_name}. Todos os direitos reservados.",
  about_label: "Sobre",
  about_url: "/sobre",
  terms_label: "Termos",
  terms_url: "/termos",
  privacy_label: "Privacidade",
  privacy_url: "/privacidade",
  contact_label: "Contato",
  contact_url: "/contato",
};

type SettingsMap = {
  branding: BrandingSettings;
  contact: ContactSettings;
  support: SupportSettings;
  hero_banner: HeroBannerCarouselSettings;
  hero_banner_student: HeroBannerCarouselSettings;
  hero_banner_teacher: HeroBannerCarouselSettings;
  secondary_banner: HeroBannerCarouselSettings;
  secondary_banner_student: HeroBannerCarouselSettings;
  secondary_banner_teacher: HeroBannerCarouselSettings;
  featured_videos: FeaturedVideosSettings;
  subscription_plans: SubscriptionPlansSettings;
  video_pricing: VideoPricingSettings;
  free_trial: FreeTrialSettings;
  about_us: AboutUsSettings;
  terms_of_use: TermsOfUseSettings;
  terms_of_use_students: TermsOfUseSettings;
  terms_of_use_teachers: TermsOfUseSettings;
  privacy_policy: PrivacyPolicySettings;
  doubt_response_deadline_days: number;
  product_config: ProductConfigSettings;
  twilio_config: TwilioConfigSettings;
  retention_coupon: RetentionCouponSettings;
  aula_particular_config: AulaParticularConfigSettings;
  footer: FooterSettings;
  alert_box: AlertBoxSettings;
  ai_avatar: AiAvatarSettings;
  ai_generation_params: AiGenerationParamsSettings;
};

/** Avatar da professora/professor virtual usado nos slides gerados por IA. */
export interface AiAvatarSettings {
  /** Nome exibido nos slides (editável pelo administrador). */
  name: string;
  /** Gênero do avatar — define a voz da narração. */
  gender: "female" | "male";
  /** Imagem do avatar. Vazio = imagem padrão da plataforma. */
  image_url: string;
  /** Legenda derivada do gênero — nunca editável pelo administrador. */
  role_label: string;
}

/** Legenda fixa do avatar, derivada do gênero (voz) escolhido. */
export const aiRoleLabel = (gender: "female" | "male") =>
  gender === "male" ? "Professor virtual" : "Professora virtual";

export const DEFAULT_AI_AVATAR: AiAvatarSettings = {
  name: "Professora Ana",
  gender: "female",
  image_url: "",
  role_label: "Professora virtual",
};

/** Tipos de conteúdo gerados por IA aos quais um avatar pode ser vinculado. */
export const AI_CONTENT_TYPES = [
  { id: "apresentacao", label: "Apresentação narrada (slides)" },
  { id: "resumo", label: "Resumo" },
  { id: "simulado", label: "Simulado" },
  { id: "top_questoes", label: "Top Questões" },
  { id: "colinha", label: "Colinha" },
] as const;

export type AiContentTypeId = (typeof AI_CONTENT_TYPES)[number]["id"];

/** Avatar vinculado a disciplinas e tipos de conteúdo gerados por IA. */
export interface AiDisciplineAvatar extends AiAvatarSettings {
  id: string;
  /** Disciplinas/áreas atendidas por este avatar. Vazio = todas. */
  disciplines: string[];
  /** Tipos de conteúdo atendidos por este avatar. Vazio = todos. */
  content_types: AiContentTypeId[];
}

export interface AiGenerationParamsSettings {
  avatars: AiDisciplineAvatar[];
}

export const DEFAULT_AI_GENERATION_PARAMS: AiGenerationParamsSettings = {
  avatars: [],
};

export const emptyAiDisciplineAvatar = (): AiDisciplineAvatar => ({
  id: crypto.randomUUID(),
  name: "",
  gender: "female",
  image_url: "",
  role_label: "Professora virtual",
  disciplines: [],
  content_types: [],
});

/**
 * Escolhe o avatar mais adequado para a disciplina e o tipo de conteúdo.
 * Cai no avatar padrão quando nenhum avatar específico combina.
 */
export function resolveAiAvatar(
  params: AiGenerationParamsSettings | null | undefined,
  fallback: AiAvatarSettings,
  options: { disciplina?: string | null; contentType?: AiContentTypeId } = {},
): AiAvatarSettings {
  const list = params?.avatars ?? [];
  if (!list.length) return fallback;
  const disciplina = (options.disciplina || "").toLowerCase().trim();

  const matches = list.filter((avatar) => {
    if (!avatar.name?.trim()) return false;
    const typeOk =
      !avatar.content_types?.length ||
      !options.contentType ||
      avatar.content_types.includes(options.contentType);
    if (!typeOk) return false;
    if (!avatar.disciplines?.length) return true;
    if (!disciplina) return false;
    return avatar.disciplines.some((d) => {
      const term = d.toLowerCase().trim();
      return term.length > 0 && (disciplina.includes(term) || term.includes(disciplina));
    });
  });

  if (!matches.length) return fallback;
  // Prioriza o avatar com vínculo específico de disciplina.
  const specific = matches.find((a) => a.disciplines?.length);
  const chosen = specific || matches[0];
  return {
    name: chosen.name,
    gender: chosen.gender,
    image_url: chosen.image_url,
    role_label: aiRoleLabel(chosen.gender),
  };
}

export interface TwilioConfigSettings {
  sms_from_number: string;
  whatsapp_from_number: string;
}

export interface RetentionCouponSettings {
  enabled: boolean;
  coupon_id: string;
  discount_label: string;
  duration_label: string;
  eligible_reasons: string[];
  headline: string;
  message: string;
  /** Months the student must wait after accepting the coupon before becoming
   *  eligible for a new retention offer. 0 = block forever (one-shot). */
  cooldown_months: number;
}

export type LateCancelFeeType = "percentage" | "fixed";

export interface AulaParticularConfigSettings {
  /** Duração padrão de cada aula particular em minutos. */
  lesson_duration_minutes: number;
  /** Janela em horas durante a qual o aluno pode cancelar sem custo
   *  (medida a partir do horário marcado da aula). */
  free_cancel_window_hours: number;
  /** Como a taxa de cancelamento tardio é calculada. */
  late_cancel_fee_type: LateCancelFeeType;
  /** Valor da taxa: percentual (0-100) quando type='percentage' ou
   *  valor em reais quando type='fixed'. */
  late_cancel_fee_value: number;
  /** Percentual da taxa que fica com a plataforma. */
  fee_split_platform_pct: number;
  /** Percentual da taxa que vai para o professor. */
  fee_split_teacher_pct: number;
  /** Janelas (em horas) antes do início da aula em que disparamos lembretes
   *  por WhatsApp/SMS para aluno e professor. Ex.: [24, 2]. */
  reminder_windows_hours: number[];
}

export const DEFAULT_AULA_PARTICULAR_CONFIG: AulaParticularConfigSettings = {
  lesson_duration_minutes: 50,
  free_cancel_window_hours: 3,
  late_cancel_fee_type: "percentage",
  late_cancel_fee_value: 50,
  fee_split_platform_pct: 30,
  fee_split_teacher_pct: 70,
  reminder_windows_hours: [24, 2],
};

export interface ProductConfigSettings {
  revisoes: {
    max_recording_minutes: number;
    enable_recording: boolean;
    enable_subtitles: boolean;
    enable_blackboard: boolean;
    enable_auto_cover: boolean;
    enable_libras: boolean;
    enable_watermark: boolean;
    title_max: number;
    description_max: number;
  };
  resumos: {
    text_max: number;
  };
  simulados: {
    question_max: number;
    option_max: number;
    min_questions: number;
    min_options: number;
  };
  top_questoes: {
    question_max: number;
    answer_max: number;
    min_questions: number;
  };
  colinhas: {
    bullet_max: number;
    min_bullets: number;
  };
}

export const DEFAULT_PRODUCT_CONFIG: ProductConfigSettings = {
  revisoes: {
    max_recording_minutes: 30,
    enable_recording: true,
    enable_subtitles: false,
    enable_blackboard: false,
    enable_auto_cover: false,
    enable_libras: false,
    enable_watermark: true,
    title_max: 100,
    description_max: 200,
  },
  resumos: { text_max: 250 },
  simulados: { question_max: 200, option_max: 200, min_questions: 5, min_options: 3 },
  top_questoes: { question_max: 300, answer_max: 300, min_questions: 5 },
  colinhas: { bullet_max: 100, min_bullets: 10 },
};

export function usePlatformSettings<K extends keyof SettingsMap>(key: K) {
  const [data, setData] = useState<SettingsMap[K] | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data: row, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      console.error("Error fetching setting", key, error);
    } else if (row) {
      setData(row.value as unknown as SettingsMap[K]);
    }
    setLoading(false);
  }, [key]);

  useEffect(() => { fetch(); }, [fetch]);

  const update = useCallback(async (value: SettingsMap[K]) => {
    const { error } = await supabase
      .from("platform_settings")
      .upsert(
        { key, value: JSON.parse(JSON.stringify(value)) },
        { onConflict: "key" },
      );

    if (error) {
      toast({ title: "Erro", description: "Falha ao salvar configuração.", variant: "destructive" });
      return false;
    }
    setData(value);
    toast({ title: "Salvo", description: "Configuração atualizada com sucesso." });
    return true;
  }, [key, toast]);

  return { data, loading, update, refetch: fetch };
}

export function useAllPlatformSettings() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value");

      if (!error && data) {
        const map: Record<string, unknown> = {};
        data.forEach((row) => { map[row.key] = row.value; });
        setSettings(map);
      }
      setLoading(false);
    };
    fetchAll();
  }, []);

  return { settings, loading };
}
