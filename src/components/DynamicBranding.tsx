import { useEffect } from "react";
import { useAllPlatformSettings } from "@/hooks/usePlatformSettings";

function hexToHSL(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const DynamicBranding = () => {
  const { settings, loading } = useAllPlatformSettings();

  useEffect(() => {
    if (loading) return;
    const branding = settings.branding as {
      primary_color?: string;
      secondary_color?: string;
      accent_color?: string;
      background_color?: string;
      button_text_color?: string;
      primary_button_bg?: string;
      primary_button_text?: string;
      secondary_button_bg?: string;
      secondary_button_text?: string;
    } | undefined;

    if (!branding) return;

    const root = document.documentElement;

    // Primary button background overrides primary_color when explicitly set,
    // so the global --primary token always matches the configured CTA color.
    const primaryBg = branding.primary_button_bg || branding.primary_color;
    if (primaryBg) {
      const hsl = hexToHSL(primaryBg);
      if (hsl) {
        root.style.setProperty("--primary", hsl);
        root.style.setProperty("--ring", hsl);
        root.style.setProperty("--sidebar-primary", hsl);
        root.style.setProperty("--sidebar-ring", hsl);
      }
    }

    const secondaryBg = branding.secondary_button_bg || branding.secondary_color;
    if (secondaryBg) {
      const hsl = hexToHSL(secondaryBg);
      if (hsl) {
        root.style.setProperty("--secondary", hsl);
        root.style.setProperty("--sidebar-accent", hsl);
      }
    }

    if (branding.accent_color) {
      const hsl = hexToHSL(branding.accent_color);
      if (hsl) {
        root.style.setProperty("--accent", hsl);
      }
    }

    if (branding.background_color) {
      const hsl = hexToHSL(branding.background_color);
      if (hsl) {
        root.style.setProperty("--background", hsl);
        root.style.setProperty("--sidebar-background", hsl);
      }
    }

    const primaryFg = branding.primary_button_text || branding.button_text_color;
    if (primaryFg) {
      const hsl = hexToHSL(primaryFg);
      if (hsl) {
        root.style.setProperty("--primary-foreground", hsl);
        root.style.setProperty("--sidebar-primary-foreground", hsl);
      }
    }

    const secondaryFg = branding.secondary_button_text || branding.button_text_color;
    if (secondaryFg) {
      const hsl = hexToHSL(secondaryFg);
      if (hsl) {
        root.style.setProperty("--secondary-foreground", hsl);
        root.style.setProperty("--sidebar-accent-foreground", hsl);
      }
    }
  }, [settings, loading]);

  return null;
};

export default DynamicBranding;
