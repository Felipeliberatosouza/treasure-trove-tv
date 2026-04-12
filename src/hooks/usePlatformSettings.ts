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

export interface HeroBannerSettings {
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  banner_image_url?: string;
}

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
  hero_banner: HeroBannerSettings;
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
};

export interface ProductConfigSettings {
  revisoes: {
    max_recording_minutes: number;
    enable_recording: boolean;
    enable_subtitles: boolean;
    enable_blackboard: boolean;
    enable_auto_cover: boolean;
  };
  colinhas: Record<string, unknown>;
  resumos: Record<string, unknown>;
  top_questoes: Record<string, unknown>;
  simulados: Record<string, unknown>;
}

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
