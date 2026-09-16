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

/** Returns the relative luminance (0–1) of a hex color per WCAG. */
function hexLuminance(hex: string): number | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel(parseInt(m[1], 16));
  const g = channel(parseInt(m[2], 16));
  const b = channel(parseInt(m[3], 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1: string, hex2: string): number | null {
  const l1 = hexLuminance(hex1);
  const l2 = hexLuminance(hex2);
  if (l1 == null || l2 == null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Picks white or black for best contrast against the given bg hex. */
function autoContrastText(bgHex: string): string {
  const lum = hexLuminance(bgHex);
  if (lum == null) return "#ffffff";
  return lum > 0.5 ? "#000000" : "#ffffff";
}

/**
 * Returns the configured text color when it has acceptable contrast (>= 4.5
 * AA), otherwise auto-picks white/black against the background.
 */
function ensureContrast(bgHex: string, fgHex: string): string {
  const ratio = contrastRatio(bgHex, fgHex);
  if (ratio != null && ratio >= 4.5) return fgHex;
  return autoContrastText(bgHex);
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
      primary_button_hover_bg?: string;
      primary_button_hover_text?: string;
      secondary_button_bg?: string;
      secondary_button_text?: string;
      secondary_button_hover_bg?: string;
      secondary_button_hover_text?: string;
      selection_button_bg?: string;
      selection_button_text?: string;
      selection_button_selected_bg?: string;
      selection_button_selected_text?: string;
      input_bg?: string;
      input_text?: string;
      input_border?: string;
      textarea_bg?: string;
      textarea_text?: string;
      textarea_border?: string;
    } | undefined;

    if (!branding) return;

    const root = document.documentElement;

    // Detecta modo claro/escuro a partir da cor de fundo escolhida pelo admin
    // e grava o resultado em <html data-theme="..."> para que o bloco CSS
    // `[data-theme="light"]` (src/index.css) reescreva automaticamente todos
    // os tokens semânticos de superfície e texto quando o fundo for claro.
    const bgLum = branding.background_color ? hexLuminance(branding.background_color) : null;
    const themeMode: "light" | "dark" = bgLum != null && bgLum > 0.5 ? "light" : "dark";
    root.setAttribute("data-theme", themeMode);

    // Ajusta o foreground automaticamente para preto/branco conforme o fundo,
    // garantindo contraste AA (só quando o admin não configurou explicitamente).
    if (branding.background_color) {
      const autoFg = autoContrastText(branding.background_color);
      const autoFgHsl = hexToHSL(autoFg);
      if (autoFgHsl) {
        root.style.setProperty("--foreground", autoFgHsl);
        root.style.setProperty("--card-foreground", autoFgHsl);
        root.style.setProperty("--popover-foreground", autoFgHsl);
        root.style.setProperty("--sidebar-foreground", autoFgHsl);
      }
    }

    // Favicon dinâmico: substitui o ícone da aba do navegador quando o admin
    // configurar um PNG customizado em Configurações → Identidade Visual.
    const faviconUrl = (settings.branding as { favicon_url?: string } | undefined)?.favicon_url;
    if (faviconUrl) {
      const head = document.head;
      // Remove todos os <link rel="icon"> e apple-touch-icon existentes.
      head.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach((el) => el.parentNode?.removeChild(el));
      const icon = document.createElement("link");
      icon.rel = "icon";
      icon.type = "image/png";
      icon.href = faviconUrl;
      head.appendChild(icon);
      const apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      apple.href = faviconUrl;
      head.appendChild(apple);
    }

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

    // Selection buttons (multi-choice chips). Stored as raw colors so they can
    // be consumed via `bg-[var(--selection-btn-bg)]` Tailwind arbitrary values.
    const selBg = branding.selection_button_bg || branding.secondary_button_bg || "#000000";
    const selFgRaw = branding.selection_button_text || branding.secondary_button_text || autoContrastText(selBg);
    const selFg = ensureContrast(selBg, selFgRaw);
    const selActiveBg = branding.selection_button_selected_bg || branding.primary_button_bg || branding.primary_color || "#3b82f6";
    const selActiveFgRaw = branding.selection_button_selected_text || branding.primary_button_text || branding.button_text_color || autoContrastText(selActiveBg);
    const selActiveFg = ensureContrast(selActiveBg, selActiveFgRaw);
    root.style.setProperty("--selection-btn-bg", selBg);
    root.style.setProperty("--selection-btn-text", selFg);
    root.style.setProperty("--selection-btn-active-bg", selActiveBg);
    root.style.setProperty("--selection-btn-active-text", selActiveFg);

    // Form fields & textareas — apply via global CSS rules so every shadcn
    // Input/Textarea picks them up automatically.
    const ensureStyleTag = () => {
      let tag = document.getElementById("dynamic-field-branding") as HTMLStyleElement | null;
      if (!tag) {
        tag = document.createElement("style");
        tag.id = "dynamic-field-branding";
        document.head.appendChild(tag);
      }
      return tag;
    };

    const inputBg = branding.input_bg;
    const inputText = branding.input_text;
    const inputBorder = branding.input_border;
    const taBg = branding.textarea_bg;
    const taText = branding.textarea_text;
    const taBorder = branding.textarea_border;

    if (inputBg || inputText || inputBorder || taBg || taText || taBorder) {
      const rules: string[] = [];
      // Single-line inputs (exclude color/file/checkbox/radio/range so the color
      // pickers in this very settings screen still work as native swatches).
      const inputSel = `input:not([type="color"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])`;
      const inputDecls: string[] = [];
      if (inputBg) inputDecls.push(`background-color: ${inputBg} !important;`);
      if (inputText) inputDecls.push(`color: ${inputText} !important;`);
      if (inputBorder) inputDecls.push(`border-color: ${inputBorder} !important;`);
      if (inputDecls.length) {
        rules.push(`${inputSel} { ${inputDecls.join(" ")} }`);
        if (inputText) {
          rules.push(`${inputSel}::placeholder { color: ${inputText} !important; opacity: 0.55; }`);
        }
      }
      const taDecls: string[] = [];
      if (taBg) taDecls.push(`background-color: ${taBg} !important;`);
      if (taText) taDecls.push(`color: ${taText} !important;`);
      if (taBorder) taDecls.push(`border-color: ${taBorder} !important;`);
      if (taDecls.length) {
        rules.push(`textarea { ${taDecls.join(" ")} }`);
        if (taText) {
          rules.push(`textarea::placeholder { color: ${taText} !important; opacity: 0.55; }`);
        }
      }
      ensureStyleTag().textContent = rules.join("\n");
    }

    // Hover colors for primary & secondary buttons — override shadcn's default
    // `hover:bg-primary/90` / `hover:bg-secondary/80` opacity-based hover so
    // admins can pick explicit hover bg + text colors.
    const ensureHoverTag = () => {
      let tag = document.getElementById("dynamic-button-hover-branding") as HTMLStyleElement | null;
      if (!tag) {
        tag = document.createElement("style");
        tag.id = "dynamic-button-hover-branding";
        document.head.appendChild(tag);
      }
      return tag;
    };
    const pHoverBg = branding.primary_button_hover_bg;
    const pHoverFg = branding.primary_button_hover_text;
    const sHoverBg = branding.secondary_button_hover_bg;
    const sHoverFg = branding.secondary_button_hover_text;
    const hoverRules: string[] = [];
    if (pHoverBg || pHoverFg) {
      const decls: string[] = [];
      if (pHoverBg) decls.push(`background-color: ${pHoverBg} !important;`);
      if (pHoverFg) decls.push(`color: ${pHoverFg} !important;`);
      hoverRules.push(
        `button.bg-primary:hover, a.bg-primary:hover, [role="button"].bg-primary:hover, button[class*="hover:bg-primary"]:hover, a[class*="hover:bg-primary"]:hover, [role="button"][class*="hover:bg-primary"]:hover { ${decls.join(" ")} }`
      );
    }
    if (sHoverBg || sHoverFg) {
      const decls: string[] = [];
      if (sHoverBg) decls.push(`background-color: ${sHoverBg} !important;`);
      if (sHoverFg) decls.push(`color: ${sHoverFg} !important;`);
      hoverRules.push(
        `button.bg-secondary:hover, a.bg-secondary:hover, [role="button"].bg-secondary:hover, button[class*="hover:bg-secondary"]:hover, a[class*="hover:bg-secondary"]:hover, [role="button"][class*="hover:bg-secondary"]:hover { ${decls.join(" ")} }`
      );
    }
    ensureHoverTag().textContent = hoverRules.join("\n");
  }, [settings, loading]);

  return null;
};

export default DynamicBranding;
