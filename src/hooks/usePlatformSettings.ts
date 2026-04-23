import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface BrandingSettings {
  platform_name: string;
  slogan: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
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

type SettingsMap = {
  branding: BrandingSettings;
  contact: ContactSettings;
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
};

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
      .update({ value: JSON.parse(JSON.stringify(value)) })
      .eq("key", key);

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
