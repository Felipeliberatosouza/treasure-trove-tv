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
    } | undefined;

    if (!branding) return;

    const root = document.documentElement;

    if (branding.primary_color) {
      const hsl = hexToHSL(branding.primary_color);
      if (hsl) {
        root.style.setProperty("--primary", hsl);
        root.style.setProperty("--ring", hsl);
        root.style.setProperty("--sidebar-primary", hsl);
        root.style.setProperty("--sidebar-ring", hsl);
      }
    }

    if (branding.secondary_color) {
      const hsl = hexToHSL(branding.secondary_color);
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
  }, [settings, loading]);

  return null;
};

export default DynamicBranding;
