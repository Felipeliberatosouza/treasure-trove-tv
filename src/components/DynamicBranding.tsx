import { useEffect } from "react";
import { useAllPlatformSettings } from "@/hooks/usePlatformSettings";
import { applyBranding, type BrandingVars } from "@/lib/applyBranding";
import { writeSettingsCache } from "@/lib/brandingCache";

/**
 * Aplica a identidade visual vinda do backend e guarda as configurações em
 * cache local, para que o próximo acesso já abra com as cores e a logomarca
 * corretas (sem piscar o tema padrão).
 */
const DynamicBranding = () => {
  const { settings, loading } = useAllPlatformSettings();

  useEffect(() => {
    if (loading) return;
    if (Object.keys(settings).length > 0) writeSettingsCache(settings);
    applyBranding(settings.branding as BrandingVars | undefined);
  }, [settings, loading]);

  return null;
};

export default DynamicBranding;
